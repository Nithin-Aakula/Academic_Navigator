from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Room, TimeSlot, TimetableEntry, GenerationRequest
from .serializers import RoomSerializer, TimeSlotSerializer, TimetableEntrySerializer
from .ga_engine import run_ga
import threading


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
        'subject', 'faculty__user', 'room', 'timeslot'
    ).all()
    serializer_class = TimetableEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        # Faculty only sees their own timetable
        if user.role == 'faculty':
            try:
                qs = qs.filter(faculty=user.faculty_profile)
            except Exception:
                qs = qs.none()

        semester = self.request.query_params.get('semester')
        year = self.request.query_params.get('academic_year')
        if semester:
            qs = qs.filter(semester=semester)
        if year:
            qs = qs.filter(academic_year=year)
        
        return qs


def _run_ga_async(semesters, academic_year, request_id):
    try:
        from django.db import connection
        
        # Ensure fresh connection if using threads
        connection.close()
        
        req = GenerationRequest.objects.get(id=request_id)
        req.status = 'running'
        req.save()

        result = run_ga(semesters=semesters, academic_year=academic_year, request_id=request_id)

        if result.get('error'):
            req.status = 'failed'
            req.error_message = result['error']
            req.save()
            return

        # Clean existing entries for requested criteria before bulk saving
        filter_kwargs = {'academic_year': academic_year}
        if semesters:
            filter_kwargs['semester__in'] = semesters
        TimetableEntry.objects.filter(**filter_kwargs).delete()

        # Bulk create entries based on GA results
        bulk_entries = []
        for entry in result['timetable']:
            bulk_entries.append(TimetableEntry(
                subject_id=entry['subject_id'],
                faculty_id=entry['faculty_id'],
                room_id=entry['room_id'],
                timeslot_id=entry['timeslot_id'],
                semester=entry['semester'],
                academic_year=academic_year
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
    Spawns the Genetic Algorithm asynchronously and returns a request ID for polling.
    Only allows 'admin' user role to trigger.
    """
    if request.user.role != 'admin':
        return Response({'detail': 'Only administrators can generate timetables.'}, status=status.HTTP_403_FORBIDDEN)

    # PRE-FLIGHT CHECK
    from users.models import FacultyProfile
    from academics.models import Subject
    
    missing = []
    if not Room.objects.count():
        missing.append("Rooms")
    if not FacultyProfile.objects.count():
        missing.append("Instructors")
    if not Subject.objects.count():
        missing.append("Subjects")
        
    if missing:
        return Response({
            'detail': f"Pre-Flight Check Failed: Missing dependencies ({', '.join(missing)}). Please add them before running the generator."
        }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    semesters = request.data.get('semesters', None)
    sem_str = ','.join([str(s) for s in semesters]) if semesters else ''
    academic_year = request.data.get('academic_year', '2025-26')

    # Create tracked request
    gen_req = GenerationRequest.objects.create(
        status='pending',
        progress=0,
        semesters_target=sem_str
    )

    t = threading.Thread(target=_run_ga_async, args=(semesters, academic_year, gen_req.id))
    t.start()

    return Response({
        'detail': 'Generation started.',
        'request_id': gen_req.id
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_generation_progress(request, pk):
    """
    Returns the current status of the generation request.
    """
    try:
        req = GenerationRequest.objects.get(pk=pk)
        return Response({
            'id': req.id,
            'status': req.status,
            'progress': req.progress,
            'conflict_score': req.conflict_score,
            'error_message': req.error_message
        })
    except GenerationRequest.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def validate_timetable_move(request):
    """
    Validates if moving a specific TimetableEntry to a new timeslot creates a hard conflict.
    Expects JSON: { "entry_id": 12, "new_timeslot_id": 45 }
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
            return Response({'valid': False, 'reason': 'Selected timeslot is locked globally.'})
            
        # Check faculty overlap
        fac_overlap = TimetableEntry.objects.filter(
            faculty=entry.faculty, timeslot=new_ts, academic_year=entry.academic_year
        ).exclude(id=entry.id).exists()
        
        if fac_overlap:
            return Response({'valid': False, 'reason': f'Faculty {entry.faculty} is already teaching in this slot.'})
            
        # Check room overlap
        room_overlap = TimetableEntry.objects.filter(
            room=entry.room, timeslot=new_ts, academic_year=entry.academic_year
        ).exclude(id=entry.id).exists()
        
        if room_overlap:
            return Response({'valid': False, 'reason': f'Room {entry.room} is already allocated in this slot.'})
            
        # Check semester overlap
        sem_overlap = TimetableEntry.objects.filter(
            semester=entry.semester, timeslot=new_ts, academic_year=entry.academic_year
        ).exclude(id=entry.id).exists()
        
        if sem_overlap:
             return Response({'valid': False, 'reason': f'Semester {entry.semester} already has a class in this slot.'})
             
        # Update the object if requested or just validate
        if request.data.get('commit', False):
            entry.timeslot = new_ts
            entry.save()
            return Response({'valid': True, 'reason': 'Moved successfully.'})
            
        return Response({'valid': True, 'reason': 'Move is valid.'})
        
    except (TimetableEntry.DoesNotExist, TimeSlot.DoesNotExist):
         return Response({'detail': 'Invalid IDs provided.'}, status=status.HTTP_400_BAD_REQUEST)
