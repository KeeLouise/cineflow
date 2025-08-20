from django.contrib.auth.models import User
from rest_framework import serializers

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.Charfield(write_only=True)

    class Meta:
        model = User
        fields = ("username", "password", "email")

    def create(self, validated_data):
        #Django's built-in user creation to hash the password properly - KR 19/08/2025
        return User.objects.create_user(**validated_data)