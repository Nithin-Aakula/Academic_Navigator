import base64
import json
import numpy as np
from datetime import date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import permissions, status

try:
    import cv2
    import face_recognition
    FR_AVAILABLE = True
except ImportError:
    FR_AVAILABLE = False


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def process_frame(request):
    """
    Receives a base64-encoded JPEG frame from the webcam.
    Identifies faces against enrolled student face encodings.
    Marks attendance in the DB and returns recognized student IDs.

    Expected body:
    {
        "frame": "<base64-encoded JPEG>",
        "subject_id": 1,
        "date": "2025-03-08"  (optional, defaults to today)
    }
    """
    if not FR_AVAILABLE:
        return Response(
            {'detail': 'face_recognition library not installed on this server.',
             'recognized': [], 'mock': True},
            status=status.HTTP_200_OK
        )

    frame_b64 = request.data.get('frame')
    subject_id = request.data.get('subject_id')
    log_date_str = request.data.get('date')

    if not frame_b64 or not subject_id:
        return Response({'detail': 'frame and subject_id are required.'}, status=400)

    try:
        log_date = date.fromisoformat(log_date_str) if log_date_str else date.today()
    except ValueError:
        log_date = date.today()

    # Decode frame
    try:
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    except Exception as e:
        return Response({'detail': f'Frame decode error: {e}'}, status=400)

    # Find faces in frame
    face_locations = face_recognition.face_locations(rgb_frame)
    face_encodings_in_frame = face_recognition.face_encodings(rgb_frame, face_locations)

    if not face_encodings_in_frame:
        return Response({'recognized': [], 'message': 'No faces detected in frame.'})

    # Load enrolled students
    from users.models import StudentProfile
    from academics.models import Subject, AttendanceLog

    try:
        subject = Subject.objects.get(pk=subject_id)
    except Subject.DoesNotExist:
        return Response({'detail': 'Subject not found.'}, status=404)

    enrolled_students = StudentProfile.objects.exclude(face_encoding='').exclude(face_encoding__isnull=True)

    known_encodings = []
    known_students = []
    for student in enrolled_students:
        try:
            enc = np.array(json.loads(student.face_encoding))
            known_encodings.append(enc)
            known_students.append(student)
        except Exception:
            continue

    if not known_encodings:
        return Response({'detail': 'No enrolled face encodings found.', 'recognized': []})

    recognized = []
    for face_enc in face_encodings_in_frame:
        matches = face_recognition.compare_faces(known_encodings, face_enc, tolerance=0.5)
        if True in matches:
            idx = matches.index(True)
            student = known_students[idx]
            # Write attendance
            AttendanceLog.objects.update_or_create(
                student=student,
                subject=subject,
                date=log_date,
                defaults={'status': 'present', 'marked_by_fr': True}
            )
            recognized.append({
                'student_id': student.student_id,
                'name': student.user.get_full_name(),
            })

    return Response({'recognized': recognized, 'total_faces': len(face_locations)})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def enroll_face(request):
    """
    Enrolls a student's face encoding from a base64 JPEG.
    Expected body: { "student_id": <pk>, "frame": "<base64 JPEG>" }
    """
    if not FR_AVAILABLE:
        return Response({'detail': 'face_recognition not installed.'}, status=503)

    from users.models import StudentProfile

    frame_b64 = request.data.get('frame')
    student_pk = request.data.get('student_id')

    if not frame_b64 or not student_pk:
        return Response({'detail': 'frame and student_id required.'}, status=400)

    try:
        student = StudentProfile.objects.get(pk=student_pk)
    except StudentProfile.DoesNotExist:
        return Response({'detail': 'Student not found.'}, status=404)

    try:
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    except Exception as e:
        return Response({'detail': f'Frame decode error: {e}'}, status=400)

    encodings = face_recognition.face_encodings(rgb_frame)
    if not encodings:
        return Response({'detail': 'No face detected in the provided image.'}, status=400)

    student.face_encoding = json.dumps(encodings[0].tolist())
    student.save()

    return Response({'detail': f"Face enrolled for {student.user.get_full_name()}."})
