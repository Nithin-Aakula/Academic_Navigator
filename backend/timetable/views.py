from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Room, TimeSlot, TimetableEntry, GenerationRequest, ClassGroup
from .serializers import (
    RoomSerializer, TimeSlotSerializer, TimetableEntrySerializer, ClassGroupSerializer
)
from .ga_engine import run_ga
import threading


class ClassGroupViewSet(viewsets.ModelViewSet):
    queryset = ClassGroup.objects.all()
    serializer_class = ClassGroupSerializer
    permission_classes = [permissions.IsAuthenticated]


class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [permissions.IsAuthenticated]


class TimeSlotViewSet(viewsets.ModelViewSet):
    queryset = TimeSlot.objects.all()
    serializer_class = TimeSlotSerializer
    permission_classes = [permissions.IsAuthenticated]


class TimetableEntryViewSet(viewsets.ModelViewSet):
    queryset = TimetableEntry.objects.select_related(
        'subject', 'faculty__user', 'room', 'timeslot', 'class_group'
    ).all()
    serializer_class = TimetableEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if user.role == 'faculty':
            try:
                qs = qs.filter(faculty=user.faculty_profile)
            except Exception:
                qs = qs.none()

        semester = self.request.query_params.get('semester')
        year = self.request.query_params.get('academic_year')
        class_group = self.request.query_params.get('class_group')

        if semester:
            qs = qs.filter(semester=semester)
        if year:
            qs = qs.filter(academic_year=year)
        if class_group:
            qs = qs.filter(class_group_id=class_group)

        return qs


def _run_ga_async(semesters, class_group_ids, academic_year, request_id, max_generations):
    try:
        from django.db import connection
        connection.close()

        req = GenerationRequest.objects.get(id=request_id)
        req.status = 'running'
        req.save()

        result = run_ga(
            semesters=semesters,
            class_group_ids=class_group_ids,
            academic_year=academic_year,
            request_id=request_id,
            max_generations=max_generations,
        )

        if result.get('constraint_error'):
            req.status = 'failed'
            req.error_message = 'CONSTRAINT_ERROR:' + str(result['constraint_error'])
            req.save()
            return

        if result.get('error'):
            req.status = 'failed'
            req.error_message = result['error']
            req.save()
            return

        # Delete old entries for requested criteria
        filter_kwargs = {'academic_year': academic_year}
        if semesters:
            filter_kwargs['semester__in'] = semesters
        if class_group_ids:
            filter_kwargs['class_group_id__in'] = class_group_ids
        TimetableEntry.objects.filter(**filter_kwargs).delete()

        # Bulk create
        bulk_entries = []
        for entry in result['timetable']:
            bulk_entries.append(TimetableEntry(
                subject_id=entry['subject_id'],
                faculty_id=entry['faculty_id'],
                room_id=entry['room_id'],
                timeslot_id=entry['timeslot_id'],
                semester=entry['semester'],
                academic_year=academic_year,
                class_group_id=entry.get('class_group_id'),
            ))
        TimetableEntry.objects.bulk_create(bulk_entries)

        req.status = 'completed'
        req.progress = 100
        req.conflict_score = result['conflict_score']
        req.save()

    except Exception as e:
        try:
            req = GenerationRequest.objects.get(id=request_id)
            req.status = 'failed'
            req.error_message = str(e)
            req.save()
        except Exception:
            pass


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_timetable(request):
    """
    Spawns the GA asynchronously. Returns a request_id for polling.
    Accepts optional: semesters (list), class_group_ids (list), academic_year,
    num_generations, num_faculty (unused, informational), num_classes (unused, informational).
    """
    if request.user.role != 'admin':
        return Response({'detail': 'Only administrators can generate timetables.'}, status=status.HTTP_403_FORBIDDEN)

    from users.models import FacultyProfile
    from academics.models import Subject

    missing = []
    if not Room.objects.count():
        missing.append("Rooms")
    if not FacultyProfile.objects.count():
        missing.append("Faculty")
    if not Subject.objects.count():
        missing.append("Subjects")
    if not TimeSlot.objects.count():
        missing.append("Time Slots")

    if missing:
        return Response({
            'detail': f"Pre-Flight Check Failed: Missing — {', '.join(missing)}. Please configure them first."
        }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    semesters = request.data.get('semesters', None)
    class_group_ids = request.data.get('class_group_ids', None)
    academic_year = request.data.get('academic_year', '2025-26')
    max_generations = int(request.data.get('num_generations', 200))

    sem_str = ','.join([str(s) for s in semesters]) if semesters else ''
    grp_str = ','.join([str(g) for g in class_group_ids]) if class_group_ids else ''

    gen_req = GenerationRequest.objects.create(
        status='pending',
        progress=0,
        semesters_target=sem_str + (f'|groups:{grp_str}' if grp_str else ''),
    )

    t = threading.Thread(
        target=_run_ga_async,
        args=(semesters, class_group_ids, academic_year, gen_req.id, max_generations)
    )
    t.daemon = True
    t.start()

    return Response({
        'detail': 'Generation started.',
        'request_id': gen_req.id
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_generation_progress(request, pk):
    """Returns current status of a GenerationRequest. Includes constraint_error if any."""
    try:
        req = GenerationRequest.objects.get(pk=pk)
        payload = {
            'id': req.id,
            'status': req.status,
            'progress': req.progress,
            'conflict_score': req.conflict_score,
            'error_message': req.error_message,
            'constraint_error': None,
        }
        # Parse constraint_error if stored
        if req.error_message and req.error_message.startswith('CONSTRAINT_ERROR:'):
            import ast
            try:
                payload['constraint_error'] = ast.literal_eval(req.error_message.replace('CONSTRAINT_ERROR:', '', 1))
                payload['error_message'] = None
            except Exception:
                pass
        return Response(payload)
    except GenerationRequest.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def validate_timetable_move(request):
    """
    Validates if moving a TimetableEntry to a new timeslot causes a hard conflict.
    Expects: { entry_id, new_timeslot_id, commit (optional bool) }
    """
    if request.user.role != 'admin':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    entry_id = request.data.get('entry_id')
    new_timeslot_id = request.data.get('new_timeslot_id')

    if not entry_id or not new_timeslot_id:
        return Response({'detail': 'Missing parameters.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        entry = TimetableEntry.objects.get(id=entry_id)
        new_ts = TimeSlot.objects.get(id=new_timeslot_id)

        if new_ts.is_locked:
            return Response({'valid': False, 'reason': 'Selected timeslot is locked.'})

        fac_overlap = TimetableEntry.objects.filter(
            faculty=entry.faculty, timeslot=new_ts, academic_year=entry.academic_year
        ).exclude(id=entry.id).exists()
        if fac_overlap:
            return Response({'valid': False, 'reason': f'Faculty {entry.faculty} is already teaching in this slot.'})

        room_overlap = TimetableEntry.objects.filter(
            room=entry.room, timeslot=new_ts, academic_year=entry.academic_year
        ).exclude(id=entry.id).exists()
        if room_overlap:
            return Response({'valid': False, 'reason': f'Room {entry.room} is already allocated in this slot.'})

        class_overlap = TimetableEntry.objects.filter(
            class_group=entry.class_group, timeslot=new_ts, academic_year=entry.academic_year
        ).exclude(id=entry.id).exists()
        if class_overlap:
            return Response({'valid': False, 'reason': f'Class {entry.class_group} already has a subject in this slot.'})

        if request.data.get('commit', False):
            entry.timeslot = new_ts
            entry.save()
            return Response({'valid': True, 'reason': 'Moved successfully.'})

        return Response({'valid': True, 'reason': 'Move is valid.'})

    except (TimetableEntry.DoesNotExist, TimeSlot.DoesNotExist):
        return Response({'detail': 'Invalid IDs provided.'}, status=status.HTTP_400_BAD_REQUEST)
