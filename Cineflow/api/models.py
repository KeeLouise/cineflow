from django.db import models
from django.db.models import UniqueConstraint
from django.db.models.functions import Lower
from django.conf import settings

class MoodKeyword(models.Model):
    # mood key must match your MOOD_RULES keys - KR 02/09/2025
    mood = models.CharField(max_length=40, db_index=True)
    keyword_id = models.IntegerField(db_index=True)
    keyword_name = models.CharField(max_length=200)
    weight = models.IntegerField(default=1)  # ordering/priority

    class Meta:
        unique_together = ("mood", "keyword_id")
        ordering = ["mood", "-weight", "keyword_name"]

    def __str__(self):
        return f"{self.mood}: {self.keyword_name} ({self.keyword_id})"

class Watchlist(models.Model): # To build the user's watchlist - KR 22/09/2025
    """
    A list owned by one user
    """
    user = models.ForeignKey( # Foreign key - link to the user that owns the list
        settings.AUTH_USER_MODEL, # Use the project's user table
        on_delete=models.CASCADE, # If a user is deleted, their watchlists will be deleted too
        related_name="watchlists", # user.watchlists.all() will retrieve all watchlists owned by a single user
    )

    name = models.CharField(max_length=120) # name of watchlist limited to 120 characters

    is_public = models.BooleanField(default=False) 

    created_at = models.DateTimeField(auto_now_add=True) # Stores both date & time, Django will fill automatically when the row is created

    updated_at = models.DateTimeField(auto_now=True) #similar to created_at - updates any time changes are saved

    class Meta: # Special options for how the table behaves - KR 22/09/2025
        unique_together = [("user", "name")] # 'unique_together' prevents user from having two lists with the exact same name
        ordering = ["-updated_at"] # when querying for watchlists, Django will order them newest-first automatically
        constraints = [
            UniqueConstraint(
                Lower("name"), "user",
                name="uq_watchlist-user-lower-name"
            )
        ]
        indexes = [
            models.Index(fields=["user", "updated_at"]),
        ]

    def __str__(self):
        return f"{self.user} • {self.name}"  # defines how object pronts/reads in the admin or shell - KR 22/09/2025



class WatchlistItem(models.Model): # each row will represent one movie saved inside one watchlist - KR 22/09/2025
    """
    A single movie inside a user's watchlist
    """
    STATUS_CHOICES = (
        ("planned", "Planned"),
        ("watching", "Watching"),
        ("watched", "Watched"),
        ("dropped", "Dropped"),
    )

    watchlist = models.ForeignKey(Watchlist, on_delete=models.CASCADE, related_name="items")  # links to Watchlist table - KR 22/09/2025
    tmdb_id = models.PositiveIntegerField()   # To store the movies TMDB ID from the API - KR 22/09/2025
    title = models.CharField(max_length=250)  # Saves the movie's title
    poster_path = models.CharField(max_length=300, blank=True)  # Stores the poster image path from TMDB, doesn't have to be filled if path doesn't exist

    # editable fields - KR 26/09/2025
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="planned", db_index=True)  # user can change - KR 26/09/2025
    position = models.PositiveIntegerField(default=0, db_index=True)  # manual ordering within a list - KR 26/09/2025

    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("watchlist", "tmdb_id")]  # cannot add same movie twice to the watchlist
        ordering = ["position", "-added_at"]          # default order: manual first, then newest - KR 26/09/2025
        indexes = [
            models.Index(fields=["watchlist", "-added_at"]),   # fast reorder lookups - KR 26/09/2025
            models.Index(fields=["watchlist", "-position"]),
            models.Index(fields=["tmdb_id"]),
            models.Index(fields=["watchlist", "status", "position"]),
        ]

    def save(self, *args, **kwargs):
        """
        Auto-assign a position when inserting a new item if no position was provided.
        Ensures new items append to the end of the list. - KR 27/09/2025
        """
        # Only generate on initial insert or when position is 0/None - KR 27/09/2025
        if self._state.adding and (self.position is None or self.position == 0):
            last_position = (
                self.__class__.objects
                .filter(watchlist=self.watchlist)
                .order_by("-position")
                .values_list("position", flat=True)
                .first()
            )
            self.position = (last_position or 0) + 1

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} in {self.watchlist.name}"
    

# Watch party room model - KR 29/09/2025

class Room(models.Model):                       #new databse table called Room - KR 29/09/2025
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_rooms") #owner is the user that created the room. Foreignkey means the room is linked to one user - KR
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True) #description is allowed to be empty - KR
    is_active = models.BooleanField(default=True) #when the host ends the room, this can be set to false - KR 29/09/2025
    starts_at = models.DateTimeField(null=True, blank=True)#optional date and time for when watch party starts
    invite_code = models.CharField(max_length=36, unique=True) #shareable code that lets others join
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["owner", "is_active", "created_at"])] #db index to make queries faster such as "rooms I own that are active, sorted by time" - kr

# Room Membership model - KR 29/09/2025

class RoomMembership(models.model):                                                     #This table records which users are part of which room - KR
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="memberships")#Link back to the room. If room is deleted, membership row is deleted - KR
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="room_memberships") #link to user who is a member - KR
    is_host=models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("room", "user")] #prevents same user from being added to the same room twice - KR


#RoomMovie model(suggested or queued movies in a room) - KR 29/09/2025

class RoomMovie(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="movies")
    tmdb_id = models.CharField(max_length=300, blank=True)
    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True) #which user suggested the movie. Keeps record even if user is deleted - KR
    position = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("room", "tmdb_id")]
        ordering = ["position", "-added_at"]

#WatchlistCollaborator Model - KR 29/09/2025

class WatchlistCollaborator(models.Model):
    watchlist = models.ForeignKey(Watchlist, on_delete=models.CASCADE, related_name="collaborators")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="collab_watchlists")
    can_edit = models.BooleanField(default=True)
    invited_at = models.DateTimeField(auto_now_add = True)

    class Meta:
        unique_together = [("watchlist", "user")]
        


