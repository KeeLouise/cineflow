from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Watchlist, WatchlistItem, MoodKeyword

User = get_user_model()

# --- AUTH/Registration --- KR 23/09/2025
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("username", "password", "email")

    def create(self, validated_data):
        #Django's built-in user creation to hash the password properly - KR 19/08/2025
        return User.objects.create_user(**validated_data)
    

# --- Mood Keywords --- KR 23/09/2025

class MoodKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodKeyword
        fields = ["id", "mood", "keyword_id", "keyword_name", "weight"]

# --- Watchlists --- kr 23/09/2025

class WatchlistItemSerializer(serializers.ModelSerializer): # ModelSerializer can auto-build fields from the model - KR 22/09/2025
    class Meta:  # This is where configuration of what the serializer does happens
        model = WatchlistItem  # tells DRF which model the serializer describes
        fields = ["id", "tmdb_id", "title", "poster_path", "added_at", "status"]  # lists exact fields to include JSON responses and accept in requests
        read_only_fields = ["id", "added_at"]  # server-managed, never set by clients


class WatchlistSerializer(serializers.ModelSerializer): # adds a nested field called "items". Uses serializer for each related item.
    
    items = WatchlistItemSerializer(many=True, read_only=True) # many = true means it's a list
    class Meta:
        model = Watchlist  # serializer maps to the watchlist model
        fields = ["id", "name", "is_public", "created_at", "updated_at", "items"]
        # created_at / updated_at are set by the model
        read_only_fields = ["id", "created_at", "updated_at"]
class WatchlistItemCreateSerializer(serializers.ModelSerializer):
    """
    accepts only the fields a client should send. returns the full WatchlistItem on save.
    """
    class Meta:
        model = WatchlistItem
        fields = ["tmdb_id", "title", "poster_path"]