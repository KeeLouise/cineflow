from typing import Optional

from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework import serializers

from .models import (
    Watchlist, WatchlistItem, MoodKeyword,
    Room, RoomMembership, RoomMovie, WatchRoomVote, WatchlistCollaborator,
    UserProfile,
)

User = get_user_model()

# Allowed item statuses – KR 27/09/2025
ALLOWED_ITEM_STATUSES = ("planned", "watching", "watched", "dropped")


# --- AUTH / Registration ---
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("username", "password", "email")

    # Case-insensitive uniqueness + normalization
    def validate_username(self, value: str) -> str:
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Username is required.")
        if User.objects.filter(username__iexact=v).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return v

    def validate_email(self, value: str) -> str:
        v = (value or "").strip().lower()
        if not v:
            raise serializers.ValidationError("Email is required.")
        if User.objects.filter(email__iexact=v).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return v

    def create(self, validated_data):
        """
        Create a normal *active* user so they can log in immediately.
        Email verification will still be emailed and gates enabling 2FA.
        """
        username = validated_data.get("username").strip()
        email = (validated_data.get("email") or "").strip().lower()
        password = validated_data.get("password")

        user = User.objects.create_user(username=username, email=email, password=password)

        # Ensure active
        if not user.is_active:
            user.is_active = True
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


# --- Rooms ---
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
class UserProfileMeSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField(read_only=True)
    avatar = serializers.SerializerMethodField(read_only=True)
    email_verified = serializers.SerializerMethodField(read_only=True)
    two_factor_enabled = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "email_verified",
            "two_factor_enabled",
            "avatar",
        ]
        read_only_fields = ["full_name", "email_verified", "two_factor_enabled", "avatar"]

    # computed fields
    def get_full_name(self, obj) -> str:
        fn = (getattr(obj, "first_name", "") or "").strip()
        ln = (getattr(obj, "last_name", "") or "").strip()
        full = f"{fn} {ln}".strip()
        return full or getattr(obj, "username", "")

    def get_avatar(self, obj) -> Optional[str]:
        prof = getattr(obj, "userprofile", None) or getattr(obj, "profile", None)
        if not prof:
            return None
        img = getattr(prof, "avatar", None)
        if not img:
            return None
        try:
            url = img.url
            # Clean up duplicate "media/media"
            if url.startswith("/media/media/"):
                url = url.replace("/media/media/", "/media/", 1)
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return None

    def get_email_verified(self, obj) -> bool:
        prof = getattr(obj, "userprofile", None) or getattr(obj, "profile", None)
        return bool(getattr(prof, "email_verified", False)) if prof else False

    def get_two_factor_enabled(self, obj) -> bool:
        prof = getattr(obj, "userprofile", None) or getattr(obj, "profile", None)
        return bool(getattr(prof, "two_factor_enabled", False)) if prof else False

    # partial updates for name/email/username
    def update(self, instance, validated_data):
        update_fields = []

        username = validated_data.pop("username", None)
        if username and username != instance.username:
            instance.username = username
            update_fields.append("username")

        for fld in ("first_name", "last_name", "email"):
            if fld in validated_data:
                val = validated_data[fld]
                if fld == "email":
                    val = (val or "").strip().lower()
                setattr(instance, fld, val)
                update_fields.append(fld)

        if update_fields:
            instance.save(update_fields=update_fields)

        return instance