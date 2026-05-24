"""
Serializers for authentication - converts model instances to JSON and validates data
"""
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['role', 'phone', 'store_name']


class UserSerializer(serializers.ModelSerializer):
    """Serializer to return user data (no password)"""
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']


class RegisterSerializer(serializers.ModelSerializer):
    """Handles user registration with password confirmation"""
    password = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True, label='Confirm Password')
    role = serializers.CharField(write_only=True, default='staff')
    store_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'password2', 'role', 'store_name']

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        # Extract extra fields not in User model
        role = validated_data.pop('role', 'staff')
        store_name = validated_data.pop('store_name', '')
        validated_data.pop('password2')

        # Create user with hashed password
        user = User.objects.create_user(**validated_data)

        # Create user profile
        UserProfile.objects.create(user=user, role=role, store_name=store_name)
        return user


class LoginSerializer(serializers.Serializer):
    """Validates login credentials"""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
