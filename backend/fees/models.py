from django.db import models
from users.models import StudentProfile


class FeeRecord(models.Model):
    STATUS_CHOICES = [
        ('paid', 'Paid'),
        ('partial', 'Partial'),
        ('unpaid', 'Unpaid'),
    ]
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='fees')
    semester = models.PositiveSmallIntegerField()
    amount_due = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='unpaid')
    paid_on = models.DateField(null=True, blank=True)
    receipt_number = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.amount_paid >= self.amount_due:
            self.status = 'paid'
        elif self.amount_paid > 0:
            self.status = 'partial'
        else:
            self.status = 'unpaid'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.student_id} | Sem {self.semester} | {self.status} | ₹{self.amount_due}"
