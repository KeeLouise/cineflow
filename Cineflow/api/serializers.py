from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Watchlist, WatchlistItem

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("username", "password", "email")

    def create(self, validated_data):
        #Django's built-in user creation to hash the password properly - KR 19/08/2025
        return User.objects.create_user(**validated_data)
    

from .models import MoodKeyword

class MoodKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodKeyword
        fields = ["id", "mood", "keyword_id", "keyword_name", "weight"]

class WatchlistItemSerializer(serializers.ModelSerializer): #Define a serializer for a single saved movie inside a list. ModelSerializer can auto-build fields from the model - KR 22/09/2025

    class Meta: # This is where configuration of what the serializer does happens
        model = WatchlistItem # tells DRF which model the serializer describes
        fields = ["id", "tmdb_id", "title", "poster_path", "added_at"] #lists exact fields to include JSON responses and accept in requests

class WatchlistSerializer(serializers.ModelSerializer):
    items = WatchlistItemSerializer(many=True, read_only=True) # adds a nested field called "items". Uses serializer for each related item. many = true means it's a list

    class Meta:
        model = Watchlist # serializer maps to the watchlist model
        fields = ["id", "name", "is_public", "created_at", "updated_at", "items"]

