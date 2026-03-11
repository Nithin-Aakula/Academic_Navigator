from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import StudentProfile, FacultyProfile, ParentProfile
from .serializers import (
    UserSerializer, UserCreateSerializer,
    StudentProfileSerializer, FacultyProfileSerializer,
    ParentProfileSerializer, MeSerializer
)

User = get_user_model()


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('id')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ['create', 'destroy']:
            return [IsAdminRole()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['GET'], url_path='me')
    def me(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)


class StudentProfileViewSet(viewsets.ModelViewSet):
    queryset = StudentProfile.objects.select_related('user').all()
    serializer_class = StudentProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return StudentProfile.objects.filter(user=user)
        if user.role == 'parent':
            try:
                return StudentProfile.objects.filter(id=user.parent_profile.linked_student_id)
            except Exception:
                return StudentProfile.objects.none()
        return super().get_queryset()  # admin sees all


class FacultyProfileViewSet(viewsets.ModelViewSet):
    queryset = FacultyProfile.objects.select_related('user').all()
    serializer_class = FacultyProfileSerializer
    permission_classes = [permissions.IsAuthenticated]


class ParentProfileViewSet(viewsets.ModelViewSet):
    queryset = ParentProfile.objects.select_related('user', 'linked_student').all()
    serializer_class = ParentProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
