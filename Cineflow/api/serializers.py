from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.db.models import Sum
from .models import (
    Watchlist, WatchlistItem, MoodKeyword,
    Room, RoomMembership, RoomMovie, WatchRoomVote, WatchlistCollaborator,
    UserProfile
)

User = get_user_model()

# Allowed item statuses – KR 27/09/2025
ALLOWED_ITEM_STATUSES = ("planned", "watching", "watched", "dropped")

# --- AUTH/Registration ---
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("username", "password", "email")

    def create(self, validated_data):
        """
        Create user as INACTIVE so they must verify email before logging in.
        """
        user = User.objects.create_user(**validated_data)
        if user.is_active:
            user.is_active = False
            user.save(update_fields=["is_active"])
        return user

# --- Mood Keywords ---
class MoodKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodKeyword
        fields = ["id", "mood", "keyword_id", "keyword_name", "weight"]

# --- Watchlists ---
class WatchlistItemSerializer(serializers.ModelSerializer):
    status = serializers.ChoiceField(choices=ALLOWED_ITEM_STATUSES, required=False)
    class Meta:
        model = WatchlistItem
        fields = ["id", "tmdb_id", "title", "poster_path", "added_at", "status", "position"]
        read_only_fields = ["id", "added_at", "position"]

class WatchlistCollaboratorSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    class Meta:
        model = WatchlistCollaborator
        fields = ["id", "user", "username", "can_edit", "invited_at"]
        read_only_fields = ["id", "username", "invited_at"]

class WatchlistCollaboratorInviteSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    can_edit = serializers.BooleanField(required=False, default=True)

class WatchlistSerializer(serializers.ModelSerializer):
    items = WatchlistItemSerializer(many=True, read_only=True)
    collaborators = WatchlistCollaboratorSerializer(many=True, read_only=True)
    class Meta:
        model = Watchlist
        fields = ["id", "name", "is_public", "created_at", "updated_at", "items", "collaborators"]
        read_only_fields = ["id", "created_at", "updated_at"]

class WatchlistItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WatchlistItem
        fields = ["tmdb_id", "title", "poster_path"]

class ReorderSerializer(serializers.Serializer):
    order = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)
    def validate_order(self, value):
        ids = list(value)
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Order contains duplicate item IDs.")
        return ids

# --- Rooms (unchanged from your latest) ---
class RoomMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    avatar = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = RoomMembership
        fields = ["id", "user", "username", "avatar", "is_host", "joined_at"]
        read_only_fields = ["id", "joined_at", "username", "avatar"]
    def get_avatar(self, obj):
        prof = getattr(obj.user, "profile", None)
        if prof and prof.avatar:
            try:
                return prof.avatar.url
            except Exception:
                return None
        return None

class RoomVoteSerializer(serializers.ModelSerializer):
    value = serializers.ChoiceField(choices=WatchRoomVote.VOTE_CHOICES)
    class Meta:
        model = WatchRoomVote
        fields = ["id", "room_movie", "user", "value", "created_at"]
        read_only_fields = ["id", "created_at", "user", "room_movie"]

class RoomMovieSerializer(serializers.ModelSerializer):
    score = serializers.SerializerMethodField()
    class Meta:
        model = RoomMovie
        fields = ["id", "tmdb_id", "title", "poster_path", "added_by", "added_at", "position", "score"]
        read_only_fields = ["id", "added_by", "added_at", "position", "score"]
    def get_score(self, obj):
        agg = getattr(obj, "votes_sum", None)
        if agg is not None:
            return agg
        return obj.votes.aggregate(s=Sum("value")).get("s") or 0

class RoomSerializer(serializers.ModelSerializer):
    members = RoomMembershipSerializer(source="memberships", many=True, read_only=True)
    movies = serializers.SerializerMethodField()
    class Meta:
        model = Room
        fields = ["id", "name", "description", "owner", "is_active", "starts_at", "invite_code", "created_at", "members", "movies"]
        read_only_fields = ["id", "owner", "invite_code", "created_at", "members", "movies"]
    def get_movies(self, room):
        qs = room.movies.all().annotate(votes_sum=Sum("votes__value")).order_by("position", "-votes_sum", "-added_at")
        return RoomMovieSerializer(qs, many=True).data

class RoomCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ["name", "description", "starts_at"]

class RoomAddMemberSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)

class RoomJoinSerializer(serializers.Serializer):
    invite_code = serializers.CharField(max_length=36)

class RoomAddMovieSerializer(serializers.Serializer):
    tmdb_id = serializers.IntegerField()
    title = serializers.CharField(max_length=250, required=False, allow_blank=True)
    poster_path = serializers.CharField(max_length=300, required=False, allow_blank=True)

class RoomReorderSerializer(serializers.Serializer):
    order = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)
    def validate_order(self, value):
        ids = list(value)
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Order contains duplicate item IDs.")
        return ids

# --- User Profile ---
class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField(read_only=True)
    avatar = serializers.ImageField(required=False, allow_null=True)
    class Meta:
        model = User
        fields = ["username", "email", "first_name", "last_name", "full_name", "avatar"]
        read_only_fields = ["full_name"]
    def validate_username(self, value):
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Username cannot be blank.")
        qs = User._default_manager.filter(username__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This username is already taken.")
        return v
    def get_full_name(self, obj):
        fn = (obj.first_name or "").strip()
        ln = (obj.last_name or "").strip()
        full = f"{fn} {ln}".strip()
        return full or obj.username
    def to_representation(self, instance):
        data = super().to_representation(instance)
        prof = getattr(instance, "profile", None)
        data["avatar"] = prof.avatar.url if (prof and prof.avatar) else None
        return data
    def update(self, instance, validated_data):
        from .models import UserProfile
        avatar_file = validated_data.pop("avatar", serializers.empty)
        username = validated_data.pop("username", None)
        if username is not None and username != instance.username:
            instance.username = username
        instance = super().update(instance, validated_data)
        prof, _ = UserProfile.objects.get_or_create(user=instance)
        if avatar_file is not serializers.empty:
            if avatar_file is None:
                if prof.avatar:
                    prof.avatar.delete(save=False)
                prof.avatar = None
            else:
                prof.avatar = avatar_file
            prof.save(update_fields=["avatar", "updated_at"])
        return instance