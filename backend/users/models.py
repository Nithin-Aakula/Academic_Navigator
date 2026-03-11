from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('faculty', 'Faculty'),
        ('student', 'Student'),
        ('parent', 'Parent'),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='student')

    def __str__(self):
        return f"{self.username} ({self.role})"


class StudentProfile(models.Model):
    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, related_name='student_profile'
    )
    student_id = models.CharField(max_length=20, unique=True)
    parent_user = models.ForeignKey(
        CustomUser, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='children_profiles'
    )
    department = models.CharField(max_length=100, blank=True)
    semester = models.PositiveSmallIntegerField(default=1)
    face_encoding = models.TextField(blank=True, help_text='JSON-encoded face encoding vector')
    photo = models.ImageField(upload_to='student_photos/', null=True, blank=True)

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.student_id})"


class FacultyProfile(models.Model):
    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, related_name='faculty_profile'
    )
    department = models.CharField(max_length=100)
    max_hours_per_week = models.PositiveSmallIntegerField(default=20)
    specialization_tags = models.CharField(max_length=255, blank=True, help_text="Comma-separated tags e.g. #Math,#Lab")

    def __str__(self):
        return f"Prof. {self.user.get_full_name()} — {self.department}"


class ParentProfile(models.Model):
    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, related_name='parent_profile'
    )
    linked_student = models.ForeignKey(
        StudentProfile, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='parents'
    )

    def __str__(self):
        return f"Parent of {self.linked_student}"
