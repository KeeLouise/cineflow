from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Case, When, Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import (
    Room, RoomMembership, RoomMovie, WatchRoomVote,
    Watchlist, WatchlistCollaborator
)

from ..serializers import (
    RoomSerializer, RoomCreateSerializer, RoomMembershipSerializer,
    RoomJoinSerializer, RoomMovieSerializer, RoomAddMovieSerializer,
    RoomReorderSerializer, RoomVoteSerializer,
    WatchlistCollaboratorSerializer, WatchlistCollaboratorInviteSerializer
)

# helpers - KR 29/09/2025

def _member_or_404(user, room_id) -> Room:
    """Ensure the user is a member of the room, otherwise 404 - KR 29/09/2025"""
    room = get_object_or_404(Room, id=room_id, is_active=True)
    # raises DoesNotExist -> 404 if not a member
    RoomMembership.objects.get(room=room, user=user)
    return room

def _owner_only(user, room: Room) -> None:
    """Only owner can mutate certain room fields - KR 30/09/2025"""
    if room.owner_id != user.id:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Only the room owner can perform this action.")

# Rooms: list/create - KR 29/09/2025

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def my_rooms(request):
    """
    GET -> rooms I own or am a member of
    POST -> create a new room
    """
    if request.method == "GET":
        member_room_ids = RoomMembership.objects.filter(user=request.user).values_list("room_id", flat=True)
        qs = (
            Room.objects
            .filter(id__in=member_room_ids)
            .union(Room.objects.filter(owner=request.user))
            .order_by("-created_at")
        )
        data = RoomSerializer(qs, many=True, context={"request": request}).data
        return Response(data, status=status.HTTP_200_OK)

    # POST create
    ser = RoomCreateSerializer(data=request.data, context={"request": request})
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    room = ser.save(owner=request.user)

    # auto-add owner as host - KR 29/09/2025
    RoomMembership.objects.get_or_create(room=room, user=request.user, defaults={"is_host": True})

    return Response(
        RoomSerializer(room, context={"request": request}).data,
        status=status.HTTP_201_CREATED
    )

# Room detail (view/update/delete)

@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def room_detail(request, room_id):
    """
    GET    -> room details + movies
    PATCH  -> owner can rename/describe/is_active
    DELETE -> owner can delete (soft: is_active=False)
    """
    room = _member_or_404(request.user, room_id)

    if request.method == "GET":
        return Response(
            RoomSerializer(room, context={"request": request}).data,
            status=status.HTTP_200_OK
        )

    if request.method == "PATCH":
        _owner_only(request.user, room)
        ser = RoomCreateSerializer(room, data=request.data, partial=True, context={"request": request})
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response(
            RoomSerializer(room, context={"request": request}).data,
            status=status.HTTP_200_OK
        )

    # DELETE (soft)
    _owner_only(request.user, room)
    room.is_active = False
    room.save(update_fields=["is_active"])
    return Response(status=status.HTTP_204_NO_CONTENT)

# Join by invite code 

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def room_join(request):
    """
    POST { invite_code } -> join room - KR 30/09/2025
    """
    ser = RoomJoinSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    room = get_object_or_404(Room, invite_code=ser.validated_data["invite_code"], is_active=True)
    RoomMembership.objects.get_or_create(room=room, user=request.user)
    return Response(
        RoomSerializer(room, context={"request": request}).data,
        status=status.HTTP_200_OK
    )

# Room members list

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def room_members(request, room_id):
    room = _member_or_404(request.user, room_id)
    qs = RoomMembership.objects.filter(room=room).select_related("user").order_by("-is_host", "joined_at")
    return Response(RoomMembershipSerializer(qs, many=True).data, status=status.HTTP_200_OK)

# Room movies: add / list

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def room_movies(request, room_id):
    """
    GET  -> list movies in room
    POST -> add movie to room queue
    """
    room = _member_or_404(request.user, room_id)

    if request.method == "GET":
        qs = RoomMovie.objects.filter(room=room).order_by("position", "-added_at")
        return Response(RoomMovieSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    ser = RoomAddMovieSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    # next position at tail - KR 29/09/2025
    last_pos = (
        RoomMovie.objects
        .filter(room=room)
        .order_by("-position")
        .values_list("position", flat=True)
        .first()
        or 0
    )

    create_kwargs = {
        "room": room,
        "tmdb_id": ser.validated_data["tmdb_id"],
        "added_by": request.user,
        "position": last_pos + 1,
    }
    if "title" in ser.validated_data:
        create_kwargs["title"] = ser.validated_data["title"]
    if "poster_path" in ser.validated_data:
        create_kwargs["poster_path"] = ser.validated_data["poster_path"]

    movie = RoomMovie.objects.create(**create_kwargs)
    return Response(RoomMovieSerializer(movie).data, status=status.HTTP_201_CREATED)

#  Reorder room movies 

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def room_movies_reorder(request, room_id):

    room = _member_or_404(request.user, room_id)
    ser = RoomReorderSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    ids = ser.validated_data["order"]
    owned_ids = set(RoomMovie.objects.filter(room=room, id__in=ids).values_list("id", flat=True))
    if len(owned_ids) != len(ids):
        return Response({"detail": "Order contains invalid IDs for this room."}, status=status.HTTP_400_BAD_REQUEST)

    whens = [When(id=item_id, then=pos) for pos, item_id in enumerate(ids, start=1)]
    with transaction.atomic():
        RoomMovie.objects.filter(id__in=ids).update(position=Case(*whens))

    qs = RoomMovie.objects.filter(room=room).order_by("position", "-added_at")
    return Response(RoomMovieSerializer(qs, many=True).data, status=status.HTTP_200_OK)

# Vote up/down on a room movie

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def room_movie_vote(request, room_id, movie_id):
    """
    POST { value: 1|-1 } -> up/down vote - KR 30/09/2025
    """
    room = _member_or_404(request.user, room_id)
    movie = get_object_or_404(RoomMovie, id=movie_id, room=room)

    ser = RoomVoteSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    vote, _ = WatchRoomVote.objects.update_or_create(
        room_movie=movie,
        user=request.user,
        defaults={"value": ser.validated_data["value"]},
    )
    return Response({"id": vote.id, "value": vote.value}, status=status.HTTP_200_OK)

# Watchlist collaborators (list/add/remove)

@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def watchlist_collaborators(request, list_id):
    """
    GET    -> list collaborators
    POST   -> invite/add collaborator by username
    DELETE -> remove collaborator (?user_id=)
    """
    wl = get_object_or_404(Watchlist, id=list_id, user=request.user)  # owner-only admin - KR 29/09/2025

    if request.method == "GET":
        qs = WatchlistCollaborator.objects.filter(watchlist=wl).select_related("user")
        return Response(WatchlistCollaboratorSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    if request.method == "POST":
        ser = WatchlistCollaboratorInviteSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        target = get_object_or_404(User, username=ser.validated_data["username"])

        collab, created = WatchlistCollaborator.objects.get_or_create(
            watchlist=wl, user=target,
            defaults={"can_edit": ser.validated_data["can_edit"]}
        )
        # If exists, allow updating - KR 29/09/2025
        if not created and collab.can_edit != ser.validated_data["can_edit"]:
            collab.can_edit = ser.validated_data["can_edit"]
            collab.save(update_fields=["can_edit"])

        return Response(WatchlistCollaboratorSerializer(collab).data, status=status.HTTP_201_CREATED)

    # DELETE collaborator
    user_id = request.query_params.get("user_id")
    if not user_id:
        return Response({"detail": "user_id required"}, status=status.HTTP_400_BAD_REQUEST)
    WatchlistCollaborator.objects.filter(watchlist=wl, user_id=user_id).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)