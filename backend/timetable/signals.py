from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from rest_framework.exceptions import ValidationError
from django.db.models import Sum
from .models import GenerationRequest, Analytics
from users.models import FacultyProfile
from academics.models import Subject

@receiver(pre_save, sender=GenerationRequest)
def check_generation_capacity(sender, instance, **kwargs):
    if not instance.pk and instance.status == 'pending':
        # Calculate Required Subject Hours
        # If target semesters are passed, filter by them
        subjects_qs = Subject.objects.all()
        if instance.semesters_target:
            try:
                target_sems = [int(s.strip()) for s in instance.semesters_target.split(',') if s.strip()]
                if target_sems:
                    subjects_qs = subjects_qs.filter(semester__in=target_sems)
            except ValueError:
                pass
                
        total_required_hours = subjects_qs.aggregate(total=Sum('credits'))['total'] or 0
        
        # Calculate Instructor Availability
        total_faculty_hours = FacultyProfile.objects.aggregate(total=Sum('max_hours_per_week'))['total'] or 0
        
        if total_faculty_hours == 0 and total_required_hours > 0:
            raise ValidationError("CapacityError: No instructors available but subjects require hours.")
            
        if total_faculty_hours > 0:
            ratio = total_required_hours / total_faculty_hours
            if ratio > 1.0:
                raise ValidationError(f"CapacityError: Required hours ({total_required_hours}) exceed Faculty availability ({total_faculty_hours}). Ratio: {ratio:.2f} > 1.0")

@receiver(post_save, sender=GenerationRequest)
def auto_calculate_analytics(sender, instance, created, **kwargs):
    if instance.status == 'completed' and not hasattr(instance, 'analytics'):
        # Auto-calculate efficiency scores post generation
        import json
        
        # For simulation/mock purposes since the full GA produces efficiency per department
        efficiency_map = {
            "CS": 92.5,
            "EC": 88.0,
            "ME": 85.5
        }
        
        fitness = instance.conflict_score or 0
        
        # We assume GA sets these if it wants to, otherwise we fake an efficiency map
        Analytics.objects.create(
            generation_request=instance,
            department_efficiency=efficiency_map,
            overall_fitness=fitness,
            total_teacher_gaps=0 # Simulated
        )
