from rest_framework import viewsets, permissions
from .models import FeeRecord
from .serializers import FeeRecordSerializer


class FeeRecordViewSet(viewsets.ModelViewSet):
    queryset = FeeRecord.objects.select_related('student__user').all()
    serializer_class = FeeRecordSerializer
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
        # Admin
        student_id = self.request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs
