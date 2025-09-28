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