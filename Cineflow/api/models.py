# api/models.py
from django.db import models

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