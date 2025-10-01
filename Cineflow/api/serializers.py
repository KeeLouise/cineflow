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
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import UserProfile

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    # expose user fields
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False, allow_blank=True)
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)

    # avatar handling + computed url
    avatar = serializers.ImageField(write_only=True, required=False, allow_null=True)
    avatar_url = serializers.SerializerMethodField(read_only=True)

    # 2FA & verification flags (already on profile model)
    two_factor_enabled = serializers.BooleanField(read_only=True)
    email_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserProfile
        # NOTE: keep "avatar" for uploads, "avatar_url" for reading; also return username/email
        fields = [
            "username", "email", "first_name", "last_name",
            "avatar", "avatar_url",
            "two_factor_enabled", "email_verified",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def get_avatar_url(self, obj: UserProfile):
        try:
            if obj.avatar and hasattr(obj.avatar, "url"):
                return obj.avatar.url
        except Exception:
            pass
        return None

    def to_representation(self, instance: UserProfile):
        """Keep backward compatibility: also put avatar_url into 'avatar' for the FE."""
        data = super().to_representation(instance)
        data["avatar"] = data.get("avatar_url")
        return data

    def update(self, instance: UserProfile, validated_data):
        """
        Allow updating first/last name on the related User and avatar on the profile.
        Pass 'avatar': null to remove image, or use 'remove_avatar' flag in the view.
        """
        user_data = validated_data.pop("user", {})
        avatar_file = validated_data.pop("avatar", serializers.empty)

        # Update user fields if provided
        user = instance.user
        changed = False
        for field in ("first_name", "last_name"):
            if field in user_data:
                setattr(user, field, user_data[field])
                changed = True
        if changed:
            user.save(update_fields=["first_name", "last_name"])

        # Update avatar if provided in payload
        if avatar_file is not serializers.empty:
            if avatar_file is None:
                # remove existing avatar
                if instance.avatar:
                    try:
                        instance.avatar.delete(save=False)
                    except Exception:
                        pass
                instance.avatar = None
            else:
                instance.avatar = avatar_file

        # Save profile (captures avatar + updated_at)
        instance.save()
        return instance