"""
Genetic Algorithm Timetable Generator using PyGAD.

Constraints:
- No room double-booking in the same timeslot
- No faculty double-booking in the same timeslot
- No semester double-booking in the same timeslot
- Faculty max_hours_per_week respected
"""
import random
import pygad
import numpy as np


def run_ga(semesters=None, academic_year='2025-26', request_id=None, max_generations=100):
    """
    Runs the GA to generate a timetable for multiple classes simultaneously.
    Returns dict with keys: timetable, conflict_score, generations, error.
    """
    try:
        from .models import Room, TimeSlot, TimetableEntry, ConstraintConfig, GenerationRequest
        from academics.models import Subject
        from users.models import FacultyProfile

        config = ConstraintConfig.get_config()
        
        # --- Load constraints from DB ---
        rooms = list(Room.objects.all())
        timeslots = list(TimeSlot.objects.order_by('day', 'period'))
        faculties = list(FacultyProfile.objects.select_related('user').all())

        if semesters:
            subjects = list(Subject.objects.filter(semester__in=semesters))
        else:
            subjects = list(Subject.objects.all())

        if not subjects or not rooms or not timeslots:
            return {'error': 'Insufficient data (no subjects, rooms, or timeslots configured).'}

        n = len(subjects)  # number of genes = number of subjects
        num_rooms = len(rooms)
        num_slots = len(timeslots)
        num_faculty = len(faculties)

        # Pre-calculate locked slots
        locked_slot_indices = {i for i, ts in enumerate(timeslots) if ts.is_locked}

        # Gene space: each gene is [room_idx, timeslot_idx, faculty_idx]
        gene_space = []
        for _ in subjects:
            gene_space.extend([
                {'low': 0, 'high': num_rooms - 1},
                {'low': 0, 'high': num_slots - 1},
                # For simplicity, we stick to the Subject's assigned faculty if available, else mutate
                {'low': 0, 'high': num_faculty - 1},
            ])

        def fitness_func(ga_instance, solution, solution_idx):
            fitness = 0
            room_slot_pairs = {}
            faculty_slot_pairs = {}
            sem_slot_pairs = {}
            faculty_periods_by_day = {}
            faculty_hours = {}

            for i, subj in enumerate(subjects):
                r_idx = int(round(solution[i * 3]))
                ts_idx = int(round(solution[i * 3 + 1]))
                f_idx = int(round(solution[i * 3 + 2]))

                # Clamp indices
                r_idx = max(0, min(r_idx, num_rooms - 1))
                ts_idx = max(0, min(ts_idx, num_slots - 1))
                f_idx = max(0, min(f_idx, num_faculty - 1))
                
                # Try to enforce assigned faculty if the Subject has one
                if subj.faculty:
                    try:
                        f_idx = faculties.index(subj.faculty)
                    except ValueError:
                        pass

                r_key = (r_idx, ts_idx)
                f_key = (f_idx, ts_idx)
                s_key = (subj.semester, ts_idx)

                # Hard Conflicts: -1000
                if r_key in room_slot_pairs:
                    fitness -= 1000
                room_slot_pairs[r_key] = True

                if f_key in faculty_slot_pairs:
                    fitness -= 1000
                faculty_slot_pairs[f_key] = True

                if s_key in sem_slot_pairs:
                    fitness -= 1000
                sem_slot_pairs[s_key] = True
                
                # Locked Slot Check
                if ts_idx in locked_slot_indices:
                    fitness -= 1000
                    
                # Faculty hour check
                faculty_hours[f_idx] = faculty_hours.get(f_idx, 0) + 1
                if faculty_hours[f_idx] > faculties[f_idx].max_hours_per_week:
                    fitness -= 1000

                # Track periods for Teacher Gap calculation
                ts_obj = timeslots[ts_idx]
                day = ts_obj.day
                period = ts_obj.period
                
                if f_idx not in faculty_periods_by_day:
                    faculty_periods_by_day[f_idx] = {}
                if day not in faculty_periods_by_day[f_idx]:
                    faculty_periods_by_day[f_idx][day] = []
                faculty_periods_by_day[f_idx][day].append(period)

                # Preferred Slots: +100 (e.g., mornings are preferred over very late)
                if period <= 3:
                     fitness += 100
                     
            # Teacher Gap Penalty: -50 per gap hole
            for f_idx, days in faculty_periods_by_day.items():
                for day, per_list in days.items():
                    if len(per_list) >= 2:
                        per_list.sort()
                        # Count gaps between consecutive scheduled classes
                        for k in range(1, len(per_list)):
                            gap = per_list[k] - per_list[k-1] - 1
                            if gap > 0:
                                fitness -= (50 * gap)

            return fitness
            
        def on_generation(ga_instance):
            # Async progress update to GenerationRequest
            if request_id:
                try:
                    perc = int((ga_instance.generations_completed / ga_instance.num_generations) * 100)
                    GenerationRequest.objects.filter(id=request_id).update(progress=perc)
                except Exception:
                    pass

        pop_size = 20
        keep_elitism = max(1, int(pop_size * config.elite_percentage))

        ga = pygad.GA(
            num_generations=max_generations,
            num_parents_mating=5,
            fitness_func=fitness_func,
            sol_per_pop=pop_size,
            num_genes=n * 3,
            gene_space=gene_space,
            mutation_percent_genes=config.mutation_rate * 100,
            parent_selection_type='sss',
            crossover_type='single_point',
            mutation_type='random',
            keep_elitism=keep_elitism,
            stop_criteria='saturate_15', # Stop if no improvement for 15 generations
            suppress_warnings=True,
            on_generation=on_generation
        )
        ga.run()

        best_solution, best_fitness, _ = ga.best_solution()
        conflict_score = best_fitness

        # --- Build timetable output ---
        timetable = []
        for i, subj in enumerate(subjects):
            r_idx = int(round(best_solution[i * 3]))
            ts_idx = int(round(best_solution[i * 3 + 1]))
            f_idx = int(round(best_solution[i * 3 + 2]))
            
            r_idx = max(0, min(r_idx, num_rooms - 1))
            ts_idx = max(0, min(ts_idx, num_slots - 1))
            f_idx = max(0, min(f_idx, num_faculty - 1))
            
            if subj.faculty:
                try:
                    f_idx = faculties.index(subj.faculty)
                except ValueError:
                    pass

            room = rooms[r_idx]
            slot = timeslots[ts_idx]
            faculty = faculties[f_idx]

            timetable.append({
                'subject_id': subj.id,
                'subject_code': subj.code,
                'subject_name': subj.name,
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
            GenerationRequest.objects.filter(id=request_id).update(progress=100, conflict_score=conflict_score)

        return {
            'timetable': timetable,
            'conflict_score': conflict_score,
            'generations': ga.generations_completed,
            'error': None,
        }

    except Exception as e:
        if request_id:
            from .models import GenerationRequest
            GenerationRequest.objects.filter(id=request_id).update(status='failed', error_message=str(e))
        return {'error': str(e), 'timetable': [], 'conflict_score': -1, 'generations': 0}
