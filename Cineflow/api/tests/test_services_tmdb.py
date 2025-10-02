from unittest import TestCase
from unittest.mock import patch, MagicMock
from importlib import import_module


def _first_callable(mod, names):
    for n in names:
        f = getattr(mod, n, None)
        if callable(f):
            return f, n
    return None, None


class TMDBServiceUnitTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.tmdb = import_module("api.services.tmdb")

    @patch("api.services.tmdb.requests.get")
    def test_search_movies_calls_expected_endpoint(self, mock_get):
        # Find a search function by common names
        func, name = _first_callable(
            self.tmdb,
            ["search_movies", "search", "search_tmdb", "search_movie", "search_multi"],
        )
        if not func:
            self.skipTest("No search function exported by api.services.tmdb")

        # Mock a successful TMDB response
        r = MagicMock()
        r.status_code = 200
        r.json.return_value = {"results": []}
        mock_get.return_value = r

        # Call it with a typical query
        func(query="Inception")

        # Validate we hit a TMDB search endpoint and passed the query along
        self.assertTrue(mock_get.called, f"{name} did not perform a requests.get()")
        called_url, called_kwargs = mock_get.call_args
        url = called_url[0] if called_url else ""
        params = called_kwargs.get("params", {})

        self.assertIn("/search", url.lower(), f"Expected search endpoint, got {url}")
        self.assertIn("query", params, "Expected 'query' in request params")
        self.assertEqual(params.get("query"), "Inception")

    @patch("api.services.tmdb.requests.get")
    def test_movie_details_happy_path(self, mock_get):
        # Find a movie details function by common names
        func, name = _first_callable(
            self.tmdb,
            ["movie_details", "get_movie", "details", "fetch_movie", "movie"],
        )
        if not func:
            self.skipTest("No movie-details function exported by api.services.tmdb")

        movie_id = 42

        # Mock a successful TMDB response
        r = MagicMock()
        r.status_code = 200
        r.json.return_value = {"id": movie_id, "title": "Life, the Universe and Everything"}
        mock_get.return_value = r

        # Call it
        out = func(movie_id=movie_id) if "movie_id" in func.__code__.co_varnames else func(42)

        self.assertTrue(mock_get.called, f"{name} did not perform a requests.get()")
        called_url, _ = mock_get.call_args
        url = called_url[0] if called_url else ""
        self.assertIn(f"/movie/{movie_id}", url.lower(), f"Expected /movie/{movie_id} in URL, got {url}")

        if isinstance(out, dict):
            self.assertEqual(out.get("id"), movie_id)

    @patch("api.services.tmdb.requests.get")
    def test_handles_non_200s_by_raising_or_returning_error(self, mock_get):
        candidates = [
            _first_callable(self.tmdb, ["search_movies", "search", "search_tmdb", "search_movie"]),
            _first_callable(self.tmdb, ["movie_details", "get_movie", "details", "fetch_movie", "movie"]),
        ]

        func, name = next(((f, n) for (f, n) in candidates if f), (None, None))
        if not func:
            self.skipTest("No suitable TMDB function exported by api.services.tmdb")

        
        r = MagicMock()
        r.status_code = 500
        r.text = "Internal error"
        r.json.side_effect = ValueError("not json")
        mock_get.return_value = r

        try:
            if "query" in func.__code__.co_varnames:
                result = func(query="test")
            elif "movie_id" in func.__code__.co_varnames:
                result = func(movie_id=999)
            else:
                result = func()
        except Exception:

            return

        self.assertTrue(
            result in (None, {}, []) or (isinstance(result, dict) and any(k in result for k in ["error", "detail", "message"])),
            f"{name} should handle non-200s safely; got {result!r}",
        )