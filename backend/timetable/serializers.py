from rest_framework import serializers
from .models import Room, TimeSlot, TimetableEntry, ClassGroup


class ClassGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassGroup
        fields = ['id', 'name', 'department', 'semester', 'room_name', 'effective_date']


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = '__all__'


class TimeSlotSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source='get_day_display', read_only=True)

    class Meta:
        model = TimeSlot
        fields = ['id', 'day', 'day_name', 'period', 'start_time', 'end_time', 'is_locked', 'slot_label']


class TimetableEntrySerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    is_special = serializers.BooleanField(source='subject.is_special', read_only=True)
    faculty_name = serializers.CharField(source='faculty.user.get_full_name', read_only=True)
    room_name = serializers.CharField(source='room.name', read_only=True)
    day = serializers.IntegerField(source='timeslot.day', read_only=True)
    day_name = serializers.CharField(source='timeslot.get_day_display', read_only=True)
    period = serializers.IntegerField(source='timeslot.period', read_only=True)
    start_time = serializers.TimeField(source='timeslot.start_time', read_only=True)
    end_time = serializers.TimeField(source='timeslot.end_time', read_only=True)
    is_locked = serializers.BooleanField(source='timeslot.is_locked', read_only=True)
    class_group_name = serializers.CharField(source='class_group.name', read_only=True)

    class Meta:
        model = TimetableEntry
        fields = [
            'id', 'subject', 'subject_name', 'subject_code', 'is_special',
            'faculty', 'faculty_name', 'room', 'room_name',
            'timeslot', 'day', 'day_name', 'period',
            'start_time', 'end_time', 'is_locked',
            'semester', 'academic_year',
            'class_group', 'class_group_name',
        ]
