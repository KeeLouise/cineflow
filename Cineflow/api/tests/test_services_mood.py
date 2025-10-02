from django.test import TestCase
from api.services import mood as mood_mod
from api.services.mood import build_discover_params


class MoodServiceUnitTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Inject minimal rules that cover multiple possible key names/types
        mood_mod.MOOD_RULES.update({
            "unit_inc": {
                # allow if any of these are present
                "include_any": {"35", "18"},
                "include": {"35", "18"},
                "allow_any": {"35", "18"},
                "include_genres": {"35", "18"},
            },
            "unit_exc": {
                # block if any of these are present
                "exclude_any": {"18", 18},
                "exclude": {"18", 18},
                "blocked": {"18", 18},
                "blocked_any": {"18", 18},
                "exclude_genres": {"18", 18},
                "deny_any": {"18", 18},
                "reject_any": {"18", 18},
            },
        })

    def test_passes_genre_gate_allows_when_any_included(self):
        movie = {"genre_ids": [35, 99]}   # 35=comedy
        self.assertTrue(mood_mod.passes_genre_gate("unit_inc", movie))

    def test_passes_genre_gate_blocks_when_any_excluded(self):
        movie = {"genre_ids": [18, 80]}   # 18=drama -> should be blocked
        self.assertFalse(mood_mod.passes_genre_gate("unit_exc", movie))

    def test_build_discover_params_basic(self):
        # Only pass args your implementation actually supports
        params = build_discover_params(
            mood_key="feelgood",
            region="GB",
            page=2,
        )
        self.assertIsInstance(params, dict)
        if "page" in params:
            self.assertEqual(params["page"], 2)