from django.db import IntegrityError  # This is raised when a database rule such as a unique constraint is violated. Used to catch "movie already in this list". - KR 23/09/2025
from django.db import transaction      # bulk reorder - KR 26/09/2025
from django.db.models import Case, When, Max 
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes  # Turn functions into API endpoints(@api_view) and set access rules. - KR 23/09/2025
from rest_framework.permissions import IsAuthenticated  # only logged in users can use this view
from rest_framework.response import Response  # return this from view to send JSON back to the client.
from rest_framework import status
from ..models import Watchlist, WatchlistItem
from ..serializers import (
    WatchlistSerializer,
    WatchlistItemSerializer,
    WatchlistItemCreateSerializer,  # used for input validation when adding an item
    ReorderSerializer,              # bulk reorder payload validator - KR 26/09/2025
)

# Allowed statuses for item state machine (UI: Will Watch / Watched / Dropped)
ALLOWED_ITEM_STATUSES = {"planned", "watching", "watched", "dropped"}  # keep in sync with frontend - KR 26/09/2025


# ownership helper
def _owned_watchlist_or_404(request, pk: int) -> Watchlist:
    """
    Load a watchlist by primary key (id) and ensure it belongs to the current user, otherwise
    return 404 error
    """
    return get_object_or_404(Watchlist, id=pk, user=request.user)


@api_view(["GET", "POST"])  # Endpoint supports two methods; GET & POST
@permission_classes([IsAuthenticated])  # only logged-in users can call it
def my_watchlists(request):  # defines the function
    """
    GET returns all watchlists that belong to the current user
    POST create a new watchlist for the current user
    """
    if request.method == "GET":  # branch for get requests
        qs = Watchlist.objects.filter(user=request.user).order_by("-updated_at")  # queries the database for only this user's watchlists
        data = WatchlistSerializer(qs, many=True).data  # uses serializers to turn dbase objects into JSON. Many=True means this is a 'list' of objects
        return Response(data, status=status.HTTP_200_OK)  # send the JSON back to the user with HTTP status 200 OK

    # POST (create)
    ser = WatchlistSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    wl = Watchlist.objects.create(  # .validated_data is cleaned version of the input JSON. **ser.validated_data unpacks it into keyword arguments for the model.
        user=request.user,
        **ser.validated_data
    )
    return Response(WatchlistSerializer(wl).data, status=status.HTTP_201_CREATED)


# ---------- Watchlist(view/update/delete) ----------

@api_view(["GET", "PUT", "DELETE"])         # 3 methods: view, update, delete
@permission_classes([IsAuthenticated])      # Must be logged in
def watchlist_detail(request, pk):
    """
    GET    -> return details of one watchlist (includes nested items)
    PUT    -> update the name and/or is_public
    DELETE -> remove the watchlist completely
    """
    wl = _owned_watchlist_or_404(request, pk)  # 404 if not found or not owned

    if request.method == "GET":
        data = WatchlistSerializer(wl).data     # Single row - JSON
        return Response(data, status=status.HTTP_200_OK)

    if request.method == "PUT":
        ser = WatchlistSerializer(
            wl,                                 # existing instance to update
            data=request.data,                  # new data
            partial=True                        # allow partial updates
        )
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ser.save()                              # write to DB
        return Response(ser.data, status=status.HTTP_200_OK)

    # DELETE
    wl.delete()                                 # remove the row
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------- Add item to watchlist ----------

@api_view(["POST"])                     # only POST is allowed
@permission_classes([IsAuthenticated])  # must be logged-in
def add_item(request, list_id):         # list_id = the watchlist id
    """
    Add a movie into a watchlist by ID
    """
    wl = _owned_watchlist_or_404(request, list_id)  # 404 if not found or not owned

    # Determine next position (append to end) - KR 26/09/2025
    next_pos = (WatchlistItem.objects.filter(watchlist=wl).aggregate(m=Max("position"))["m"] or 0) + 1

    ser = WatchlistItemCreateSerializer(data=request.data)  # validate the incoming item data
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Avoid duplicates
        item, created = WatchlistItem.objects.get_or_create(
            watchlist=wl,                                                # Link to the parent list
            tmdb_id=ser.validated_data["tmdb_id"],                       # uniqueness key with watchlist
            defaults={                                                   # only used if a new row is created
                "title": ser.validated_data["title"],
                "poster_path": ser.validated_data.get("poster_path", ""),
                "status": "planned",                                     # default state on add - KR 26/09/2025
                "position": next_pos,                                    # append at end - KR 26/09/2025
            }
        )
    except IntegrityError:
        existing = WatchlistItem.objects.get(watchlist=wl, tmdb_id=ser.validated_data["tmdb_id"])
        return Response(WatchlistItemSerializer(existing).data, status=status.HTTP_200_OK)

    return Response(
        WatchlistItemSerializer(item).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
    )


# ---------- Update an item's status / position ----------

@api_view(["PUT"])                  # only PUT is allowed - KR 26/09/2025
@permission_classes([IsAuthenticated])
def update_item(request, list_id, item_id):
    """
    Update fields of a watchlist item.
    Supported fields: status ("planned" | "watching" | "watched" | "dropped"), position (int)
    """
    wl = _owned_watchlist_or_404(request, list_id)                       
    item = get_object_or_404(WatchlistItem, pk=item_id, watchlist=wl)

    data = request.data.copy()

    # Strictly validate status if provided - KR 26/09/2025
    if "status" in data:
        status_val = str(data["status"]).lower().strip()
        if status_val not in ALLOWED_ITEM_STATUSES:
            return Response(
                {"detail": f"Invalid status '{status_val}'. Allowed: {sorted(ALLOWED_ITEM_STATUSES)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data["status"] = status_val

    if "position" in data:
        try:
            data["position"] = int(data["position"])
        except (TypeError, ValueError):
            return Response({"detail": "position must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

    ser = WatchlistItemSerializer(
        item,
        data=data,
        partial=True
    )
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    ser.save()  # writes status/position if provided - KR 26/09/2025
    return Response(ser.data, status=status.HTTP_200_OK)


# ---------- Remove item from a watchlist ----------

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def remove_item(request, list_id, item_id): 
    """
    Remove one movie from a watchlist
    """
    wl = _owned_watchlist_or_404(request, list_id)                      # 404 if not found or not owned
    item = get_object_or_404(WatchlistItem, pk=item_id, watchlist=wl)   # Find the item within this list
    item.delete()                                                       # remove that one row
    return Response(status=status.HTTP_204_NO_CONTENT)                  # 204 No Content(success)


# ---------- Bulk reorder items ----------
@api_view(["POST"])                   
@permission_classes([IsAuthenticated])
def reorder_items(request, list_id):
    """
    Set a new explicit order for items in a list.
    Body: { "order": [item_id, item_id, ...] } (must contain only items from this watchlist)
    """
    wl = _owned_watchlist_or_404(request, list_id)

    # Fetch full current order so partial payloads are supported (non-breaking) - KR 27/09/2025
    current_ids = list(
        WatchlistItem.objects
        .filter(watchlist=wl)
        .order_by("position", "-added_at")
        .values_list("id", flat=True)
    )

    ser = ReorderSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    ids = ser.validated_data["order"]

    # Validate all provided IDs belong to this watchlist - KR 26/09/2025
    provided_ids = list(ids)
    owned_ids = set(
        WatchlistItem.objects
        .filter(watchlist=wl, id__in=provided_ids)
        .values_list("id", flat=True)
    )
    if len(owned_ids) != len(provided_ids):
        return Response({"detail": "Order contains invalid item IDs."}, status=status.HTTP_400_BAD_REQUEST)

    # Build a normalized order that supports partial payloads by appending the rest - KR 27/09/2025
    seen = set()
    new_order = []
    for i in provided_ids:
        if i in owned_ids and i not in seen:
            new_order.append(i)
            seen.add(i)
    for i in current_ids:
        if i not in seen:
            new_order.append(i)
            seen.add(i)

    # Lock affected rows and update positions in a single query - KR 27/09/2025
    when_list = [When(id=item_id, then=pos) for pos, item_id in enumerate(new_order, start=1)]
    with transaction.atomic():
        (WatchlistItem.objects
            .select_for_update()
            .filter(watchlist=wl, id__in=new_order)
            .update(position=Case(*when_list))
        )
        # touch parent to bump ordering in list view - KR 27/09/2025
        Watchlist.objects.filter(id=wl.id).update(updated_at=F("updated_at"))

    # Serializer Meta/related manager should return items ordered by position - KR 27/09/2025
    data = WatchlistSerializer(wl).data
    return Response(data, status=status.HTTP_200_OK)