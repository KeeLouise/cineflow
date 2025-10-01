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
    # Enforce valid status values at the serializer layer too – KR 27/09/2025
    status = serializers.ChoiceField(choices=ALLOWED_ITEM_STATUSES, required=False)
    class Meta:  # This is where configuration of what the serializer does happens
        model = WatchlistItem  # tells DRF which model the serializer describes
        fields = ["id", "tmdb_id", "title", "poster_path", "added_at", "status", "position"]  # lists exact fields to include JSON responses and accept in requests
        read_only_fields = ["id", "added_at", "position"]  # server-managed, never set by clients


class WatchlistCollaboratorSerializer(serializers.ModelSerializer):
    """
    Read-only view of collaborators on a watchlist.
    Includes the collaborator's username for display
    """
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = WatchlistCollaborator
        fields = ["id", "user", "username", "can_edit", "invited_at"]
        read_only_fields = ["id", "username", "invited_at"]


class WatchlistCollaboratorInviteSerializer(serializers.Serializer):
    """
    Payload to invite/add a collaborator to a watchlist by username
    """
    username = serializers.CharField(max_length=150)
    can_edit = serializers.BooleanField(required=False, default=True)


class WatchlistSerializer(serializers.ModelSerializer): # adds a nested field called "items". Uses serializer for each related item.
    
    items = WatchlistItemSerializer(many=True, read_only=True) # many = true means it's a list
    collaborators = WatchlistCollaboratorSerializer(many=True, read_only=True)
    class Meta:
        model = Watchlist 
        fields = ["id", "name", "is_public", "created_at", "updated_at", "items", "collaborators"]
        read_only_fields = ["id", "created_at", "updated_at"]
class WatchlistItemCreateSerializer(serializers.ModelSerializer):
    """
    accepts only the fields a client should send. returns the full WatchlistItem on save.
    """
    class Meta:
        model = WatchlistItem
        fields = ["tmdb_id", "title", "poster_path"]

class ReorderSerializer(serializers.Serializer):
    order = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False
    )

    def validate_order(self, value):
        """
        Ensure the order array is a list of unique integers > 0.
        Keeps client drag-and-drop reorders in place and prevents accidental duplicates – KR 28/09/2025
        """
        ids = list(value)
        # Ensure uniqueness
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Order contains duplicate item IDs.")
        return ids
    
#  Watch Party Rooms - KR 29/09/2025

class RoomMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    avatar = serializers.SerializerMethodField(read_only=True)  # add

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
    invite_code = serializers.SerializerMethodField(read_only=True)   # gate it
    is_host_current = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Room
        fields = [
            "id", "name", "description", "owner", "is_active", "starts_at",
            "invite_code", "created_at", "members", "movies", "is_host_current"
        ]
        read_only_fields = [
            "id", "owner", "invite_code", "created_at", "members", "movies", "is_host_current"
        ]

    def get_invite_code(self, room):
        request = self.context.get("request")
        if request and request.user and request.user.id == room.owner_id:
            return room.invite_code
        return None  # hidden for non-hosts

    def get_is_host_current(self, room):
        request = self.context.get("request")
        return bool(request and request.user and request.user.id == room.owner_id)

    def get_movies(self, room):
        qs = (
            room.movies
            .all()
            .annotate(votes_sum=Sum("votes__value"))
            .order_by("position", "-votes_sum", "-added_at")
        )
        return RoomMovieSerializer(qs, many=True).data

class RoomCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ["name", "description", "starts_at"]  # owner/invite_code filled server-side

class RoomAddMemberSerializer(serializers.Serializer):  # invite by username - KR 29/09/2025
    username = serializers.CharField(max_length=150)

class RoomJoinSerializer(serializers.Serializer):  # join by invite code - KR 29/09/2025
    invite_code = serializers.CharField(max_length=36)

class RoomAddMovieSerializer(serializers.Serializer): 
    tmdb_id = serializers.IntegerField()
    title = serializers.CharField(max_length=250, required=False, allow_blank=True)
    poster_path = serializers.CharField(max_length=300, required=False, allow_blank=True)

class RoomReorderSerializer(serializers.Serializer): 
    order = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False
    )
    def validate_order(self, value):
        ids = list(value)
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Order contains duplicate item IDs.")
        return ids

# --- User Profile --- KR 30/09/2025


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField(read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["username", "email", "first_name", "last_name", "full_name", "avatar"]
        read_only_fields = ["full_name"]

    def get_full_name(self, obj):
        fn = (obj.first_name or "").strip()
        ln = (obj.last_name or "").strip()
        return f"{fn} {ln}".strip() or obj.username

    def get_avatar(self, obj):
        prof = getattr(obj, "profile", None)
        if prof and prof.avatar:
            try:
                return prof.avatar.url
            except Exception:
                return None
        return None

    def update(self, instance, validated_data):
        # Handle avatar separately
        avatar_file = self.context["request"].data.get("avatar", None)

        if avatar_file is not None:
            prof, _ = UserProfile.objects.get_or_create(user=instance)
            prof.avatar = avatar_file
            prof.save(update_fields=["avatar", "updated_at"])

        return super().update(instance, validated_data)