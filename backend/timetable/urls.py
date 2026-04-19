from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (
    ClassGroupViewSet, RoomViewSet, TimeSlotViewSet,
    TimetableEntryViewSet, generate_timetable,
    get_generation_progress, validate_timetable_move
)

router = DefaultRouter()
router.register(r'class-groups', ClassGroupViewSet)
router.register(r'rooms', RoomViewSet)
router.register(r'timeslots', TimeSlotViewSet)
router.register(r'timetable', TimetableEntryViewSet)

urlpatterns = [
    path('timetable/generate/', generate_timetable, name='timetable-generate'),
    path('timetable/progress/<int:pk>/', get_generation_progress, name='timetable-progress'),
    path('timetable/validate_move/', validate_timetable_move, name='timetable-validate-move'),
    path('', include(router.urls)),
]
