from django.test import SimpleTestCase
from api.services.mood import passes_genre_gate, build_discover_params, MOOD_RULES

class MoodRulesTests(SimpleTestCase):
    def test_feelgood_excludes_horror_thriller(self):
        # Fake movie “Parasite” style genres
        movie = {"genre_ids": [18, 53]}  # 18=Drama, 53=Thriller - KR
        ok = passes_genre_gate("feelgood", movie)
        # Should be False because Thriller (53) is excluded in feelgood rules - KR
        self.assertFalse(ok)

    def test_feelgood_includes_comedy_family(self):
        movie = {"genre_ids": [35, 10751]}  # Comedy + Family - KR
        ok = passes_genre_gate("feelgood", movie)
        self.assertTrue(ok)

    def test_build_discover_params_providers_and_votes(self):
        p = build_discover_params("feelgood", region="GB", providers="8|337", types="flatrate", page=2, filters={"min_votes": 10})
        self.assertEqual(p["with_watch_providers"], "8|337")
        self.assertEqual(p["vote_count.gte"], str(max(10, MOOD_RULES["feelgood"]["min_votes_floor"])))
        self.assertEqual(p["watch_region"], "GB")
        self.assertEqual(p["with_watch_monetization_types"], "flatrate")
        self.assertEqual(p["page"], 2)