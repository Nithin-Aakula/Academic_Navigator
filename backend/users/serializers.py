from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import StudentProfile, FacultyProfile, ParentProfile

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role']
        read_only_fields = ['id']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'password']
        read_only_fields = ['id']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class StudentProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )

    class Meta:
        model = StudentProfile
        fields = ['id', 'user', 'user_id', 'student_id', 'parent_user',
                  'department', 'semester', 'photo']


class FacultyProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    # Write-only integer: pass the user's PK when creating a profile
    user_pk = serializers.IntegerField(write_only=True, required=False)
    subjects_count = serializers.SerializerMethodField()

    class Meta:
        model = FacultyProfile
        fields = ['id', 'user', 'user_pk', 'department', 'max_hours_per_week', 'subjects_count']

    def get_subjects_count(self, obj):
        return obj.subjects.count()

    def create(self, validated_data):
        user_pk_value = validated_data.pop('user_pk', None)
        instance = FacultyProfile(**validated_data)
        if user_pk_value is not None:
            instance.user_id = user_pk_value
        instance.save()
        return instance


class ParentProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    linked_student = StudentProfileSerializer(read_only=True)

    class Meta:
        model = ParentProfile
        fields = ['id', 'user', 'linked_student']


class MeSerializer(serializers.ModelSerializer):
    """Returns current user info + nested profile"""
    student_profile = StudentProfileSerializer(read_only=True)
    faculty_profile = FacultyProfileSerializer(read_only=True)
    parent_profile = ParentProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'role', 'student_profile', 'faculty_profile', 'parent_profile']
