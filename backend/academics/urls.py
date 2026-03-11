from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import SubjectViewSet, MarksViewSet, AttendanceLogViewSet, BacklogViewSet, ComplaintViewSet

router = DefaultRouter()
router.register(r'subjects', SubjectViewSet)
router.register(r'marks', MarksViewSet)
router.register(r'attendance', AttendanceLogViewSet)
router.register(r'backlogs', BacklogViewSet)
router.register(r'complaints', ComplaintViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
