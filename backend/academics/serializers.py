from rest_framework import serializers
from users.models import FacultyProfile
from .models import Subject, Marks, AttendanceLog, Backlog, Complaint


class SubjectSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.user.get_full_name', read_only=True, default='')
    # Allow null so PATCH requests can assign OR unassign faculty
    faculty = serializers.PrimaryKeyRelatedField(
        queryset=FacultyProfile.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Subject
        fields = ['id', 'code', 'name', 'faculty', 'faculty_name', 'semester', 'max_students', 'credits', 'is_special']


class MarksSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)

    class Meta:
        model = Marks
        fields = ['id', 'student', 'subject', 'subject_name', 'subject_code',
                  'internal', 'external', 'total', 'grade', 'exam_year', 'exam_month']
        read_only_fields = ['total', 'grade']


class AttendanceLogSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)

    class Meta:
        model = AttendanceLog
        fields = ['id', 'student', 'student_id', 'subject', 'subject_code',
                  'date', 'status', 'marked_by_fr', 'created_at']
        read_only_fields = ['created_at']


class AttendanceSummarySerializer(serializers.Serializer):
    """Per-subject attendance percentage for a student."""
    subject_code = serializers.CharField()
    subject_name = serializers.CharField()
    total_classes = serializers.IntegerField()
    attended = serializers.IntegerField()
    percentage = serializers.FloatField()
    status = serializers.CharField()  # 'safe', 'warning', 'critical'


class BacklogSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)

    class Meta:
        model = Backlog
        fields = ['id', 'student', 'subject', 'subject_name', 'subject_code',
                  'exam_date', 'cleared', 'registered_on']


class ComplaintSerializer(serializers.ModelSerializer):
    resolved_by_name = serializers.CharField(source='resolved_by.get_full_name', read_only=True)

    class Meta:
        model = Complaint
        fields = ['id', 'target_hod_department', 'body', 'created_at', 'status', 'resolved_by', 'resolved_by_name']
        read_only_fields = ['created_at', 'resolved_by']
