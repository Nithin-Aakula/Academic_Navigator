from rest_framework import serializers
from .models import LibraryBook


class LibraryBookSerializer(serializers.ModelSerializer):
    class Meta:
        model = LibraryBook
        fields = '__all__'
