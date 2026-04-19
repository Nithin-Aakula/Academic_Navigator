"""
Genetic Algorithm Timetable Generator — Multi-Class Edition (PyGAD)

Hard Constraints (−1000 pts each):
  - Faculty double-booking (same faculty, same timeslot, different entries)
  - Room double-booking (same room, same timeslot)
  - Class double-booking (same ClassGroup, same timeslot, two subjects)
  - Locked timeslot scheduled
  - Faculty exceeds max_hours_per_week

Soft Constraints:
  - Library/Sports ('is_special') must appear exactly 2× per week per class (−500 per violation)
  - Faculty has >3 consecutive teaching periods in a day (−200 per extra period)
  - Faculty period gaps (−50 per gap hole)
  - Morning preference (+50 for period ≤ 3)

Pre-run over-leverage check:
  Returns ConstraintError before GA starts if total teaching demand > faculty supply.
"""

import pygad
import numpy as np


# ---------------------------------------------------------------------------
# Faculty over-leverage pre-check
# ---------------------------------------------------------------------------

def check_faculty_leverage(class_groups, subjects_per_group):
    """
    Returns list of dicts describing over-leveraged faculty, or empty list if OK.
    subjects_per_group: {class_group_id: [Subject,...]}
    """
    from users.models import FacultyProfile

    # Tally how many sessions each faculty needs
    faculty_demand = {}  # faculty_id -> (FacultyProfile, total_sessions)
    for group_id, subj_list in subjects_per_group.items():
        for subj in subj_list:
            if subj.faculty_id:
                fid = subj.faculty_id
                if fid not in faculty_demand:
                    faculty_demand[fid] = [subj.faculty, 0]
                faculty_demand[fid][1] += 1

    errors = []
    for fid, (fac, demand) in faculty_demand.items():
        cap = fac.max_hours_per_week
        if demand > cap:
            errors.append({
                'faculty_id': fid,
                'faculty_name': fac.user.get_full_name(),
                'demand': demand,
                'capacity': cap,
                'over_by': demand - cap,
            })
    return errors


# ---------------------------------------------------------------------------
# Main GA runner
# ---------------------------------------------------------------------------

def run_ga(
    semesters=None,
    class_group_ids=None,
    academic_year='2025-26',
    request_id=None,
    max_generations=200,
):
    """
    Runs the GA to generate conflict-free timetables for multiple ClassGroups.

    Returns dict:
      timetable        – list of entry dicts
      conflict_score   – final best fitness value (higher = fewer conflicts)
      generations      – how many generations were run
      error            – error string or None
      constraint_error – list of over-leveraged faculty dicts (if pre-check fails)
    """
    try:
        from .models import Room, TimeSlot, TimetableEntry, ConstraintConfig, GenerationRequest, ClassGroup
        from academics.models import Subject
        from users.models import FacultyProfile

        config = ConstraintConfig.get_config()

        # ── Load DB data ──────────────────────────────────────────────────
        rooms = list(Room.objects.all())
        timeslots = list(TimeSlot.objects.order_by('day', 'period'))
        faculties = list(FacultyProfile.objects.select_related('user').all())

        if class_group_ids:
            class_groups = list(ClassGroup.objects.filter(id__in=class_group_ids))
        else:
            class_groups = list(ClassGroup.objects.all())

        if not class_groups:
            # Fallback: treat each semester as a virtual "group"
            if semesters:
                subjects_qs = Subject.objects.filter(semester__in=semesters)
            else:
                subjects_qs = Subject.objects.all()
            subjects_all = list(subjects_qs.select_related('faculty__user'))
            # Build a single virtual class group
            virtual_groups = [None]  # None sentinel
            subjects_per_group = {None: subjects_all}
        else:
            # Assign subjects to class groups by semester
            subjects_per_group = {}
            for grp in class_groups:
                qs = Subject.objects.filter(semester=grp.semester)
                if semesters:
                    qs = qs.filter(semester__in=semesters)
                subjects_per_group[grp.id] = list(qs.select_related('faculty__user'))
            virtual_groups = class_groups

        if not rooms or not timeslots or not faculties:
            return {'error': 'Insufficient data (no rooms, timeslots, or faculty configured).', 'constraint_error': []}

        # ── Pre-flight: over-leverage check ───────────────────────────────
        sg_by_id = {
            (grp.id if grp else None): subjs
            for grp, subjs in zip(virtual_groups, subjects_per_group.values())
        }
        leverage_errors = check_faculty_leverage(sg_by_id, sg_by_id)
        if leverage_errors:
            return {
                'timetable': [],
                'conflict_score': -99999,
                'generations': 0,
                'error': None,
                'constraint_error': leverage_errors,
            }

        # ── Flatten: one entry per (class_group × subject) ────────────────
        # Each gene triplet: [room_idx, timeslot_idx, faculty_idx]
        entries = []  # list of (group, subject)
        for grp in virtual_groups:
            grp_id = grp.id if grp else None
            for subj in subjects_per_group.get(grp_id, []):
                entries.append((grp, subj))

        if not entries:
            return {'error': 'No subjects found for the selected semesters/classes.', 'constraint_error': []}

        n_entries = len(entries)
        num_rooms = len(rooms)
        num_slots = len(timeslots)
        num_faculty = len(faculties)

        locked_slot_indices = {i for i, ts in enumerate(timeslots) if ts.is_locked}

        # Gene space: each entry gets 3 genes [room, slot, faculty]
        gene_space = []
        for _ in entries:
            gene_space.extend([
                {'low': 0, 'high': max(0, num_rooms - 1)},
                {'low': 0, 'high': max(0, num_slots - 1)},
                {'low': 0, 'high': max(0, num_faculty - 1)},
            ])

        # ── Fitness Function ──────────────────────────────────────────────
        def fitness_func(ga_instance, solution, solution_idx):
            fitness = 0
            room_slot_map = {}       # (room_idx, ts_idx) -> True
            faculty_slot_map = {}    # (faculty_idx, ts_idx) -> True
            group_slot_map = {}      # (group_id, ts_idx) -> True
            faculty_hours = {}       # faculty_idx -> count
            faculty_day_periods = {} # faculty_idx -> {day -> [period...]}
            special_counts = {}      # (group_id, subject_is_special) -> {day -> count}

            for i, (grp, subj) in enumerate(entries):
                r_idx = int(round(solution[i * 3]))
                ts_idx = int(round(solution[i * 3 + 1]))
                f_idx = int(round(solution[i * 3 + 2]))

                # Clamp to valid range
                r_idx = max(0, min(r_idx, num_rooms - 1))
                ts_idx = max(0, min(ts_idx, num_slots - 1))
                f_idx = max(0, min(f_idx, num_faculty - 1))

                # Prefer assigned faculty
                if subj.faculty_id:
                    for fi, fac in enumerate(faculties):
                        if fac.id == subj.faculty_id:
                            f_idx = fi
                            break

                grp_id = grp.id if grp else ('sem', subj.semester)
                ts_obj = timeslots[ts_idx]
                day = ts_obj.day
                period = ts_obj.period

                # Hard: locked timeslot
                if ts_idx in locked_slot_indices:
                    fitness -= 1000

                # Hard: room double-booking
                rk = (r_idx, ts_idx)
                if rk in room_slot_map:
                    fitness -= 1000
                room_slot_map[rk] = True

                # Hard: faculty double-booking
                fk = (f_idx, ts_idx)
                if fk in faculty_slot_map:
                    fitness -= 1000
                faculty_slot_map[fk] = True

                # Hard: class double-booking
                gk = (grp_id, ts_idx)
                if gk in group_slot_map:
                    fitness -= 1000
                group_slot_map[gk] = True

                # Hard: faculty weekly hour limit
                faculty_hours[f_idx] = faculty_hours.get(f_idx, 0) + 1
                if faculty_hours[f_idx] > faculties[f_idx].max_hours_per_week:
                    fitness -= 1000

                # Soft: consecutive periods tracking
                fdp = faculty_day_periods.setdefault(f_idx, {})
                fdp.setdefault(day, []).append(period)

                # Soft: morning preference
                if period <= 3:
                    fitness += 50

                # Special subject (Library/Sports) frequency tracking
                if subj.is_special:
                    spec_key = (grp_id, 'special')
                    special_counts.setdefault(spec_key, {})
                    special_counts[spec_key][day] = special_counts[spec_key].get(day, 0) + 1

            # Soft: Library/Sports must appear exactly 2 days per week per group
            for (grp_id, _), day_map in special_counts.items():
                total_special_days = len(day_map)  # unique days with special subject
                # Ideal: 2 different days
                deviation = abs(total_special_days - 2)
                fitness -= deviation * 500

            # Soft: consecutive period check (>3 consecutive = penalty)
            for f_idx, day_map in faculty_day_periods.items():
                for day, periods_list in day_map.items():
                    if not periods_list:
                        continue
                    periods_list_sorted = sorted(periods_list)

                    # Count consecutive runs
                    run = 1
                    max_run = 1
                    for k in range(1, len(periods_list_sorted)):
                        if periods_list_sorted[k] == periods_list_sorted[k - 1] + 1:
                            run += 1
                            max_run = max(max_run, run)
                        else:
                            # Gap penalty
                            gap = periods_list_sorted[k] - periods_list_sorted[k - 1] - 1
                            if gap > 0:
                                fitness -= 50 * gap
                            run = 1
                    if max_run > 3:
                        fitness -= (max_run - 3) * 200  # −200 per extra consecutive period

            return fitness

        # ── GA Callbacks ─────────────────────────────────────────────────
        def on_generation(ga_instance):
            if request_id:
                try:
                    perc = int((ga_instance.generations_completed / ga_instance.num_generations) * 100)
                    GenerationRequest.objects.filter(id=request_id).update(progress=perc)
                except Exception:
                    pass

        # ── Run PyGAD ─────────────────────────────────────────────────────
        pop_size = 30
        keep_elitism = max(2, int(pop_size * config.elite_percentage))

        ga = pygad.GA(
            num_generations=max_generations,
            num_parents_mating=8,
            fitness_func=fitness_func,
            sol_per_pop=pop_size,
            num_genes=n_entries * 3,
            gene_space=gene_space,
            mutation_percent_genes=config.mutation_rate * 100,
            parent_selection_type='tournament',
            crossover_type='two_points',
            mutation_type='random',
            keep_elitism=keep_elitism,
            stop_criteria='saturate_20',
            suppress_warnings=True,
            on_generation=on_generation,
        )
        ga.run()

        best_solution, best_fitness, _ = ga.best_solution()

        # ── Build output timetable ─────────────────────────────────────────
        timetable = []
        for i, (grp, subj) in enumerate(entries):
            r_idx = int(round(best_solution[i * 3]))
            ts_idx = int(round(best_solution[i * 3 + 1]))
            f_idx = int(round(best_solution[i * 3 + 2]))

            r_idx = max(0, min(r_idx, num_rooms - 1))
            ts_idx = max(0, min(ts_idx, num_slots - 1))
            f_idx = max(0, min(f_idx, num_faculty - 1))

            if subj.faculty_id:
                for fi, fac in enumerate(faculties):
                    if fac.id == subj.faculty_id:
                        f_idx = fi
                        break

            room = rooms[r_idx]
            slot = timeslots[ts_idx]
            faculty = faculties[f_idx]

            timetable.append({
                'class_group_id': grp.id if grp else None,
                'class_group_name': grp.name if grp else None,
                'subject_id': subj.id,
                'subject_code': subj.code,
                'subject_name': subj.name,
                'is_special': subj.is_special,
                'semester': subj.semester,
                'faculty_id': faculty.id,
                'faculty_name': faculty.user.get_full_name(),
                'room_id': room.id,
                'room': room.name,
                'timeslot_id': slot.id,
                'day': slot.day,
                'day_name': slot.get_day_display(),
                'period': slot.period,
                'start_time': str(slot.start_time),
                'end_time': str(slot.end_time),
            })

        if request_id:
            GenerationRequest.objects.filter(id=request_id).update(
                progress=100, conflict_score=int(best_fitness)
            )

        return {
            'timetable': timetable,
            'conflict_score': int(best_fitness),
            'generations': ga.generations_completed,
            'error': None,
            'constraint_error': [],
        }

    except Exception as e:
        import traceback
        err_str = traceback.format_exc()
        if request_id:
            try:
                from .models import GenerationRequest
                GenerationRequest.objects.filter(id=request_id).update(
                    status='failed', error_message=str(e)
                )
            except Exception:
                pass
        return {
            'timetable': [],
            'conflict_score': -99999,
            'generations': 0,
            'error': str(e),
            'constraint_error': [],
        }
