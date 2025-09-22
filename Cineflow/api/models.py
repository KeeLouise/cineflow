# api/models.py
from django.db import models
from django.db.models import UniqueConstraint
from django.db.models.functions import Lower
from django.conf import settings

class MoodKeyword(models.Model):
    # mood key must match your MOOD_RULES keys - KR 02/09/2025
    mood = models.CharField(max_length=40, db_index=True)
    keyword_id = models.IntegerField(db_index=True)
    keyword_name = models.CharField(max_length=200)
    weight = models.IntegerField(default=1)  # optional: ordering/priority

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

    is_public = models.BooleanField(default=False) #BooleanField = True/False, the list will be private (default=false)

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


class WatchlistItem(models.Model): # new table. - each row will represent one movie saved inside one watchlist - KR 22/09/2025
    """
    A single movie inside a user's watchlist
    """ 
    watchlist = models.ForeignKey( # links to Watchlist table - KR 222/09/2025
        Watchlist,
        on_delete=models.CASCADE,
        related_name="items",
    )

    tmdb_id = models.PositiveIntegerField() # To store the movies TMDB ID from the API - KR 22/09/2025

    title = models.CharField(max_length=250) # Saves the movie's title

    poster_path = models.CharField(max_length=300, blank=True) # Stores the poster image path from TMDB, doesn't have to be filled if path doesn't exist

    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together=[("watchlist", "tmdb_id")] # can't add same movie twice to the watchlist
        ordering = ["-added_at"] # newest saved movies show up first
        indexes = [
            models.Index(fields=["watchlist", "added_at"]),
            models.Index(fields=["tmdb_id"]),
        ]

    def __str__(self):
        return f"{self.title} in {self.watchlist.name}"