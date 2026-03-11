from django.urls import path
from .views import process_frame, enroll_face

urlpatterns = [
    path('attendance/frame/', process_frame, name='attendance-frame'),
    path('attendance/enroll/', enroll_face, name='attendance-enroll'),
]
