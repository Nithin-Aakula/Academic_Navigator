from rest_framework import serializers
from .models import FeeRecord


class FeeRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_roll = serializers.CharField(source='student.student_id', read_only=True)
    balance = serializers.SerializerMethodField()

    class Meta:
        model = FeeRecord
        fields = ['id', 'student', 'student_name', 'student_roll', 'semester',
                  'amount_due', 'amount_paid', 'balance', 'due_date', 'status',
                  'paid_on', 'receipt_number']
        read_only_fields = ['status']

    def get_balance(self, obj):
        return float(obj.amount_due) - float(obj.amount_paid)
