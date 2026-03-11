from django.db import models
from users.models import FacultyProfile
from academics.models import Subject


class Room(models.Model):
    name = models.CharField(max_length=50, unique=True)
    capacity = models.PositiveIntegerField(default=60)
    is_lab = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class TimeSlot(models.Model):
    DAY_CHOICES = [
        (0, 'Monday'), (1, 'Tuesday'), (2, 'Wednesday'),
        (3, 'Thursday'), (4, 'Friday'), (5, 'Saturday'),
    ]
    day = models.PositiveSmallIntegerField(choices=DAY_CHOICES)
    period = models.PositiveSmallIntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_locked = models.BooleanField(default=False, help_text="Locked slots cannot be scheduled (e.g., global lunch, maintenance)")

    class Meta:
        unique_together = ('day', 'period')
        ordering = ['day', 'period']

    def __str__(self):
        lock_status = " 🔒" if self.is_locked else ""
        return f"{self.get_day_display()} P{self.period} ({self.start_time}–{self.end_time}){lock_status}"


class TimetableEntry(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='timetable_entries')
    faculty = models.ForeignKey(FacultyProfile, on_delete=models.CASCADE, related_name='timetable_entries')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='timetable_entries')
    timeslot = models.ForeignKey(TimeSlot, on_delete=models.CASCADE, related_name='entries')
    semester = models.PositiveSmallIntegerField()
    academic_year = models.CharField(max_length=9, default='2025-26')

    class Meta:
        unique_together = ('timeslot', 'room', 'academic_year')

    def __str__(self):
        return f"{self.semester}sem | {self.subject.code} | {self.room} | {self.timeslot}"


class ConstraintConfig(models.Model):
    """
    Singleton configuration for the Genetic Algorithm hyperparameters
    """
    max_consecutive_hours = models.PositiveSmallIntegerField(default=3)
    mutation_rate = models.FloatField(default=0.1)
    elite_percentage = models.FloatField(default=0.05, help_text="Percentage of top population to carry over")
    lunch_break_period = models.PositiveSmallIntegerField(default=4, help_text="The period number that acts as lunch")

    def __str__(self):
        return "Global Timetable Algorithm Configuration"

    def save(self, *args, **kwargs):
        # Enforce singleton pattern
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_config(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class GenerationRequest(models.Model):
    """
    Tracks the asynchronous or long-polling generation of timetables.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress = models.PositiveSmallIntegerField(default=0, help_text="Percentage from 0 to 100")
    conflict_score = models.IntegerField(null=True, blank=True)
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    semesters_target = models.CharField(max_length=255, blank=True, help_text="Comma-separated semesters requested")

    def __str__(self):
        return f"GenReq #{self.id} - {self.status} ({self.progress}%)"


class Analytics(models.Model):
    """
    Stores metrics and efficiency scores generated post-timetable computation.
    """
    generation_request = models.OneToOneField(GenerationRequest, on_delete=models.CASCADE, related_name='analytics')
    department_efficiency = models.JSONField(help_text="Dictionary storing efficiency scores by department")
    overall_fitness = models.FloatField()
    total_teacher_gaps = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analytics for GenReq #{self.generation_request.id}"
