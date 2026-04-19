from django.db import models
from users.models import StudentProfile, FacultyProfile


class Subject(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=120)
    faculty = models.ForeignKey(
        FacultyProfile, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='subjects'
    )
    semester = models.PositiveSmallIntegerField()
    max_students = models.PositiveIntegerField(default=60)
    credits = models.PositiveSmallIntegerField(default=3)
    is_special = models.BooleanField(
        default=False,
        help_text="Mark as True for Library/Sports — GA enforces exactly 2 sessions per week per class."
    )

    def __str__(self):
        return f"{self.code} — {self.name}"


class Marks(models.Model):
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='marks')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='marks')
    internal = models.FloatField(default=0)
    external = models.FloatField(default=0)
    total = models.FloatField(default=0)
    grade = models.CharField(max_length=5, blank=True)
    exam_year = models.PositiveSmallIntegerField()
    exam_month = models.PositiveSmallIntegerField()

    class Meta:
        unique_together = ('student', 'subject', 'exam_year', 'exam_month')

    def save(self, *args, **kwargs):
        self.total = self.internal + self.external
        self.grade = self._compute_grade(self.total)
        super().save(*args, **kwargs)

    @staticmethod
    def _compute_grade(total):
        if total >= 90: return 'O'
        if total >= 80: return 'A+'
        if total >= 70: return 'A'
        if total >= 60: return 'B+'
        if total >= 50: return 'B'
        if total >= 40: return 'C'
        return 'F'

    def __str__(self):
        return f"{self.student} | {self.subject.code} | {self.grade}"


class AttendanceLog(models.Model):
    STATUS_CHOICES = [('present', 'Present'), ('absent', 'Absent'), ('late', 'Late')]
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='attendance')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='attendance')
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='absent')
    marked_by_fr = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'subject', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.student.student_id} | {self.subject.code} | {self.date} | {self.status}"


class Backlog(models.Model):
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='backlogs')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='backlogs')
    exam_date = models.DateField(null=True, blank=True)
    cleared = models.BooleanField(default=False)
    registered_on = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'subject')

    def __str__(self):
        flag = '✓' if self.cleared else '✗'
        return f"{self.student.student_id} | {self.subject.code} [{flag}]"


class Complaint(models.Model):
    STATUS_CHOICES = [('open', 'Open'), ('resolved', 'Resolved')]
    # No direct FK to student to keep it anonymous at API level
    target_hod_department = models.CharField(max_length=100)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='open')
    resolved_by = models.ForeignKey('users.CustomUser', null=True, blank=True, on_delete=models.SET_NULL, related_name='resolved_complaints')

    def __str__(self):
        return f"Complaint to {self.target_hod_department} [{self.status}]"

from django.db.models.signals import pre_save
from django.dispatch import receiver
from rest_framework.exceptions import ValidationError

@receiver(pre_save, sender=Subject)
def prevent_null_instructor_on_subject_save(sender, instance, **kwargs):
    if not instance.faculty:
        raise ValidationError("Instructor must be assigned to this Subject. Cannot be null.")
