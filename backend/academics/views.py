from django.db.models import Count, Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Subject, Marks, AttendanceLog, Backlog, Complaint
from .serializers import (
    SubjectSerializer, MarksSerializer, AttendanceLogSerializer,
    AttendanceSummarySerializer, BacklogSerializer, ComplaintSerializer
)


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.select_related('faculty__user').all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]


class MarksViewSet(viewsets.ModelViewSet):
    queryset = Marks.objects.all()
    serializer_class = MarksSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'student':
            try:
                return qs.filter(student=user.student_profile)
            except Exception:
                return qs.none()
        student_id = self.request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)
        return qs


class AttendanceLogViewSet(viewsets.ModelViewSet):
    queryset = AttendanceLog.objects.select_related('student', 'subject').all()
    serializer_class = AttendanceLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'student':
            try:
                return qs.filter(student=user.student_profile)
            except Exception:
                return qs.none()
        if user.role == 'parent':
            try:
                return qs.filter(student=user.parent_profile.linked_student)
            except Exception:
                return qs.none()
        student_id = self.request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)
        subject_id = self.request.query_params.get('subject')
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        return qs

    @action(detail=False, methods=['GET'], url_path='summary')
    def summary(self, request):
        """Returns per-subject attendance percentage for the requesting student or a given student_id."""
        user = request.user
        if user.role == 'student':
            try:
                profile = user.student_profile
            except Exception:
                return Response({'detail': 'No student profile.'}, status=404)
        else:
            student_id = request.query_params.get('student')
            if not student_id:
                return Response({'detail': 'student param required.'}, status=400)
            from users.models import StudentProfile
            try:
                profile = StudentProfile.objects.get(pk=student_id)
            except StudentProfile.DoesNotExist:
                return Response({'detail': 'Student not found.'}, status=404)

        subjects = Subject.objects.filter(semester=profile.semester)
        result = []
        for subject in subjects:
            logs = AttendanceLog.objects.filter(student=profile, subject=subject)
            total = logs.count()
            attended = logs.filter(status='present').count()
            pct = round((attended / total * 100), 1) if total > 0 else 0.0
            if pct >= 75:
                status_label = 'safe'
            elif pct >= 60:
                status_label = 'warning'
            else:
                status_label = 'critical'
            result.append({
                'subject_code': subject.code,
                'subject_name': subject.name,
                'total_classes': total,
                'attended': attended,
                'percentage': pct,
                'status': status_label,
            })
        return Response(result)

    @action(detail=False, methods=['GET'], url_path='recent')
    def recent(self, request):
        """Returns last 20 attendance logs — used by Parent Dashboard polling."""
        user = request.user
        if user.role == 'parent':
            try:
                qs = AttendanceLog.objects.filter(
                    student=user.parent_profile.linked_student
                ).order_by('-created_at')[:20]
            except Exception:
                qs = AttendanceLog.objects.none()
        else:
            qs = AttendanceLog.objects.order_by('-created_at')[:20]
        serializer = AttendanceLogSerializer(qs, many=True)
        return Response(serializer.data)


class BacklogViewSet(viewsets.ModelViewSet):
    queryset = Backlog.objects.all()
    serializer_class = BacklogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'student':
            try:
                return qs.filter(student=user.student_profile)
            except Exception:
                return qs.none()
        return qs


class ComplaintViewSet(viewsets.ModelViewSet):
    queryset = Complaint.objects.all().order_by('-created_at')
    serializer_class = ComplaintSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            department = self.request.query_params.get('department')
            if department:
                return self.queryset.filter(target_hod_department=department)
            return self.queryset
        if user.role == 'faculty':
            try:
                dept = user.faculty_profile.department
                return self.queryset.filter(target_hod_department=dept)
            except Exception:
                return self.queryset.none()
        # Students & parents can only create, not list
        return Complaint.objects.none()

    def perform_update(self, serializer):
        user = self.request.user
        if user.role in ['admin', 'faculty'] and serializer.validated_data.get('status') == 'resolved':
            serializer.save(resolved_by=user)
        else:
            serializer.save()
