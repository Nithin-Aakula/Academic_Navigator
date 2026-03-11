from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import UserViewSet, StudentProfileViewSet, FacultyProfileViewSet, ParentProfileViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'students', StudentProfileViewSet)
router.register(r'faculty', FacultyProfileViewSet)
router.register(r'parents', ParentProfileViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
