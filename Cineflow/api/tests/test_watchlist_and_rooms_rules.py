from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase

from api.models import Watchlist, WatchlistItem, WatchlistCollaborator, Room, RoomMembership
from api.serializers import ReorderSerializer

User = get_user_model()


class WatchlistRulesTests(TestCase):
    def setUp(self):
        self.u = User.objects.create_user("wu", email="wu@ex.com", password="x"*8)
        self.wl = Watchlist.objects.create(user=self.u, name="My List")

    def test_unique_movie_in_watchlist(self):
        WatchlistItem.objects.create(watchlist=self.wl, tmdb_id=1, title="One")
        with self.assertRaises(IntegrityError):
            WatchlistItem.objects.create(watchlist=self.wl, tmdb_id=1, title="Dup")

    def test_reorder_serializer_rejects_duplicates(self):
        s = ReorderSerializer(data={"order": [1, 2, 2]})
        self.assertFalse(s.is_valid())
        self.assertIn("Order contains duplicate", str(s.errors))


class CollaboratorsTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner", email="o@ex.com", password="passpass")
        self.collab = User.objects.create_user("c", email="c@ex.com", password="passpass")
        self.wl = Watchlist.objects.create(user=self.owner, name="With Collabs")

    def test_unique_collaborator(self):
        WatchlistCollaborator.objects.create(watchlist=self.wl, user=self.collab, can_edit=True)
        with self.assertRaises(IntegrityError):
            WatchlistCollaborator.objects.create(watchlist=self.wl, user=self.collab, can_edit=False)


class RoomRulesTests(TestCase):
    def setUp(self):
        self.host = User.objects.create_user("host", email="h@ex.com", password="passpass")
        self.guest = User.objects.create_user("guest", email="g@ex.com", password="passpass")
        self.room = Room.objects.create(owner=self.host, name="Movie Night")

    def test_unique_membership(self):
        RoomMembership.objects.create(room=self.room, user=self.guest, is_host=False)
        with self.assertRaises(IntegrityError):
            RoomMembership.objects.create(room=self.room, user=self.guest, is_host=False)