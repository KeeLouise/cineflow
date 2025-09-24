from django.db import IntegrityError # This is raised when a database rule such as a unique constraint is violated. Used to catch "movie already in this list". - KR 23/09/2025
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes # Turn functions into API endpoints(@api_view) and set access rules. - KR 23/09/2025
from rest_framework import IsAuthenticated #only logged in users can use this view
from rest_framework.response import Response # return this from view to send JSON back to the client.
from rest_framework import status
from ..models import Watchlist, WatchlistItem
from ..serializers import (
    WatchlistSerializer,
    WatchlistItemSerializer,
    WatchlistItemCreateSerializer,
)

# ownership helper
def _owned_watchlist_or_404(request, pk: int) -> Watchlist:
    """
    Load a watchlist by primary key (id) and ensure it belongs to the current user, otherwise
    return 404 error
    """
    return get_object_or_404(Watchlist, id=pk, user=request.user)


@api_view(["GET", "POST"]) # Endpoint supports two methods; GET & POST
@permission_classes([IsAuthenticated]) # only logged-in users can call it
def my_watchlists(request): # defines the function
    """
    GET returns all watchlists that belong to the current user
    POST create a new watchlist for the current user
    """ 
    if request.method == "GET": # branch for get requests

        qs = Watchlist.objects.filter(user=request.user).order_by("-updated_at") # queries the database for only this user's watchlists
        data = WatchlistSerializer(qs, many=True).data #uses serializers to turn dbase objects into JSON. Many=True means this is a 'list' of objects
        return Response(data, status=200) # send teh JSON back to the user with HTTP status 200 OK
    
    ser = WatchlistSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.error, status=400)
    
    wl = Watchlist.objects.create(user=request.user, **ser.validated_data) # .validated_data is cleaned version of the input JSON. **ser.validated_data unpacks it into keyword arguments for the model.
    return Response(WatchlistSerializer(wl).data, status=status.HTTP_201_CREATED)

# ---------- Watchlist(view/update/delete) ----------

@api_view(["GET", "PUT", "DELETE"]) # Endpoint accesses 3 HTTP methods
@permission_classes([IsAuthenticated]) # only logged-in users can use this
def watchlist_detail(request, pk): # pk = primary key of the watchlist in the URL
    """
    GET: return details of one watchlist (including items)
    PUT: updated the name or is_public
    DELETE: remove the watchlist completely
    """
    try:
        wl = Watchlist.objects.get( # Try to fetch one watchlist row
            pk=pk,                  # whose ID matches the URL
            user=request.user       # and belongs to the current user
        )
    except Watchlist.DoesNotExist:
        return Response ({"detail": "Not found"}, status=404) #if it does not exist or is not the current user's watchlist
    
    if request.method == "GET":            # if the user did a GET request
        data= WatchlistSerializer(wl).data # serialize one watchlist (includes nested items)
        return Response(data)              # 200 OK by default
    
    if request.method == "PUT":            # if the user did a PUT (update)
        ser = WatchlistSerializer(         # create a serializer bound to this instance
            wl,                            # instance to update
            data=request.data,             # new data coming from the client
            partial=True                   # allow sending only the fields you want to change
        )
        if not ser.is_valid():                     # if data fails validation
            return Response(ser.error, status=400)
        ser.save()                                 # writes changes back to the DB
        return Response(ser.data)                  # return the updated watchlist as JSON (200)
    
    if request.method == "DELETE":  # if the user did a delete
        wl.delete()                 # remove the row from the DB 
        return Response(status=204) # 204 No Content = success, nothing to return
    
# ---------- Add item to watchlist ----------

@api_view(["POST"])                    # only POST is allowed
@permission_classes([IsAuthenticated]) # must be logged-in
def add_item(request, pk):             # pk = the watchlist id we're adding into
    """
    Add a movie into a watchlist by ID
    """
    try:
        wl = Watchlist.objects.get(    # fetch the parent watchlist
            pk=pk, 
            user=request.user          # enforce ownership
        )
    except Watchlist.DoesNotExist:
        return Response(ser.errors, status=400)
    
    ser = WatchlistItemSerializer(data=request.data)    # validate the incoming item data
    if not ser.is_valid():
        return Response(ser.errors, status=400)
    
    # Avoid duplicates
    item, created = WatchlistItem.objects.get_or_create(             
        watchlist=wl,                                               # Link to the parent list
        tmdb_id=ser.validated_data["tmdb_id"],                      # uniqueness key with watchlist
        defaults={                                                  # only used if a new row is created
            "title": ser.validated_data["title"],
            "poster_path": ser.validated_data.get("poster_path", "")
        }
    )

    #if it already exists, we return 200; if newly created, 201 Created
    return Response(
        WatchlistItemSerializer(item).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
    )

# ---------- Remove item from a watchlist ----------

@api_view (["DELETE"])
@permission_classes([IsAuthenticated])
def remove_item(request, pk, item_id):         # pk = watchlist id, item_id = the WtachlistItem id
    """
    Remove one movie from a watchlist
    """
    try:
        wl = Watchlist.objects.get(            # Ensure the parent list belongs to the user
            pk=pk,
            user=request.user
        )
        item = wl.items.get(pk=item_id)        # look up the item within that list
    except (Watchlist.DoesNotExist, WatchlistItem.DoesNotExist):
        return Response({"detail": "Not found"}, status=404)
    
    item.delete()                              # remove that one row
    return Response(status=204)                # 204 No Content(success)