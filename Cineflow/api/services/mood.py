from django.core.cache import cache
from .tmdb import tmdb_get

# Pinned TMDB IDs per mood  — KR 02/09/2025
PINNED_BASE = {
    "feelgood":     [260513, 398181, 210577, 496243],
    "heartwarming": [10193, 109445, 19404],
    "high_energy":  [497698, 353081, 324857, 299536],
    "chill":        [97630, 490132, 19404],
    "mind_bending": [62, 27205, 1124, 419430],
    "romantic":     [194, 13, 744, 19913],
    "family":       [862, 150540, 260513],
    "scary":        [381288, 631843, 346364],
    "tearjerker":   [598, 4922, 77338, 730154],
    "dark_gritty":  [680, 155, 807, 500],
}

# Keyword groups per mood (TMDB keyword IDs) — kept for future soft scoring — KR 19/09/2025
KEYWORDS_BASE = {
    "feelgood":     ["180547", "3370", "211029"],
    "heartwarming": ["180547", "9826", "207317"],
    "high_energy":  ["9715", "616", "15060"],
    "chill":        ["158718", "179431", "195970"],
    "mind_bending": ["4565", "804", "11109"],
    "romantic":     ["9856", "1599", "210024"],
    "family":       ["9713", "9714", "158718"],
    "scary":        ["9719", "9718", "9717"],
    "tearjerker":   ["4344", "179430", "287501"],
    "dark_gritty":  ["9716", "9710", "9824"],
}

#  Admin-configurable overrides (cache) — KR 17/09/2025
_OVR_PINS_KEY     = "mood:pins:overrides"
_OVR_KEYWORDS_KEY = "mood:keywords:overrides"

def _get_overrides(cache_key: str) -> dict:
    return cache.get(cache_key) or {}

def _set_overrides(cache_key: str, data: dict):
    cache.set(cache_key, data, 60 * 60 * 24 * 30)

def effective_pins_for(mood: str) -> list[int]:
    base = PINNED_BASE.get(mood, [])[:]
    ov = _get_overrides(_OVR_PINS_KEY).get(mood) or []
    seen, out = set(), []
    for mid in ov + base:
        if mid not in seen:
            seen.add(mid)
            out.append(mid)
    return out

def effective_keywords_for(mood: str) -> list[str]:
    base = KEYWORDS_BASE.get(mood, [])[:]
    ov = _get_overrides(_OVR_KEYWORDS_KEY).get(mood) or []
    seen, out = set(), []
    for kw in ov + base:
        if kw not in seen:
            seen.add(kw)
            out.append(kw)
    return out

# Genre constants (TMDB IDs) - kept for reference - KR 01/09/2025
_GENRE = {
    "comedy": 35, "drama": 18, "romance": 10749, "family": 10751,
    "thriller": 53, "horror": 27, "mystery": 9648, "action": 28,
    "adventure": 12, "scifi": 878, "animation": 16, "crime": 80
}

MOOD_RULES = {
    "feelgood": {
        "include_genres_any": ["35", "10751", "10402", "10749", "16", "12"],
        "exclude_genres": ["27", "53", "80", "9648"],
        "sort_by": "popularity.desc",
        "enforce_genre_gate": True,
        "cert_country": "US",
        "cert_lte": "PG-13",
        "min_votes_floor": 100,
    },
    "heartwarming": {
        "include_genres_any": ["18", "10751", "10749"],
        "exclude_genres": ["27", "53"],
        "sort_by": "popularity.desc",
        "enforce_genre_gate": True,
        "cert_country": "US",
        "cert_lte": "PG-13",
        "min_votes_floor": 100,
    },
    "high_energy": {
        "include_genres_any": ["28", "12", "53", "878"],
        "exclude_genres": [],
        "sort_by": "popularity.desc",
        "min_votes_floor": 50,
    },
    "chill": {
        "include_genres_any": ["35", "18"],
        "exclude_genres": ["27", "53"],
        "sort_by": "popularity.desc",
        "cert_country": "US",
        "cert_lte": "PG-13",
        "min_votes_floor": 80,
    },
    "mind_bending": {
        "include_genres_any": ["9648", "878", "53"],
        "exclude_genres": ["10751"],
        "sort_by": "popularity.desc",
        "min_votes_floor": 50,
    },
    "romantic": {
        "include_genres_any": ["10749", "35", "18"],
        "exclude_genres": ["27", "53"],
        "sort_by": "popularity.desc",
        "enforce_genre_gate": True,
        "cert_country": "US",
        "cert_lte": "PG-13",
        "min_votes_floor": 80,
    },
    "family": {
        "include_genres_any": ["10751", "16", "12"],
        "exclude_genres": ["27", "53", "80"],
        "sort_by": "popularity.desc",
        "enforce_genre_gate": True,
        "cert_country": "US",
        "cert_lte": "PG-13",
        "min_votes_floor": 50,
    },
    "scary": {
        "include_genres_any": ["27", "53"],
        "exclude_genres": [],
        "sort_by": "popularity.desc",
        "min_votes_floor": 50,
    },
    "tearjerker": {
        "include_genres_any": ["18", "10749"],
        "exclude_genres": ["27", "53"],
        "sort_by": "popularity.desc",
        "enforce_genre_gate": True,
        "cert_country": "US",
        "cert_lte": "PG-13",
        "min_votes_floor": 80,
    },
    "dark_gritty": {
        "include_genres_any": ["80", "53", "18"],
        "exclude_genres": ["10751", "16", "10402", "10749"],
        "sort_by": "popularity.desc",
        "min_votes_floor": 50,
    },
}

def _extract_genre_id_strings(movie: dict) -> set[str]:
    ids = set()
    if isinstance(movie.get("genre_ids"), list):
        for g in movie["genre_ids"]:
            try: ids.add(str(int(g)))
            except Exception: pass
    elif isinstance(movie.get("genres"), list):
        for g in movie["genres"]:
            try: ids.add(str(int(g.get("id"))))
            except Exception: pass
    return ids

def passes_genre_gate(mood_key: str, movie: dict) -> bool:
    """
    Strict genre gate: must include any allowed; must NOT include any excluded. - KR 19/09/2025
    """
    rules = MOOD_RULES.get(mood_key) or {}
    exc = set(rules.get("exclude_genres") or [])
    gids = _extract_genre_id_strings(movie)
    if exc and (gids & exc):  # Respectes excludes - KR 23/09/2025
        return False
    if not rules.get("enforce_genre_gate"):
        return True
    inc = set(rules.get("include_genres_any") or [])
    if not gids:
        return False
    if inc and not (gids & inc):
        return False
    return True

def filter_by_providers(results, *, region: str, providers_csv: str, limit_checks: int = 60):
    """
    Hard gate: keep only movies that actually have *any* of the selected providers in the given region.
    - `providers_csv` is pipe-joined TMDB ids (e.g. "8|337|9").
    - Only first `limit_checks` verified via /movie/{id}?append_to_response=watch/providers.  KR 20/09/2025
    """
    if not providers_csv:
        return results

    want_ids = set()
    for token in providers_csv.split("|"):
        token = token.strip()
        if token.isdigit():
            want_ids.add(int(token))
    if not want_ids:
        return results

    kept, checked = [], 0
    for m in results:
        mid = m.get("id")
        if not mid:
            continue
        if checked < limit_checks:
            detail, err = tmdb_get(f"/movie/{mid}", {"append_to_response": "watch/providers"})
            checked += 1
            if err or not detail:
                continue
            wp = (detail.get("watch/providers") or {}).get("results", {})
            rb = wp.get(region) or wp.get("US") or {}
            buckets = []
            for key in ("flatrate", "ads", "free", "rent", "buy"):
                arr = rb.get(key) or []
                if arr:
                    buckets.extend(arr)
            have_ids = {int(p.get("provider_id")) for p in buckets if p.get("provider_id")}
            if have_ids & want_ids:
                kept.append(m)
        else:
            kept.append(m)
    return kept

def build_discover_params(
    mood_key: str, *, region="GB", providers="", types="flatrate,ads,free", page=1, filters: dict | None = None
):
    """
    Build TMDB /discover/movie params from MOOD_RULES.
    - Genre OR gate (pipe) + excludes.
    - Adds include_adult=false globally.
    - Applies optional filters (decade/year range, rating, votes, runtime, lang, sort).
    - Applies mood-level certification cap and min_votes floor where defined. — KR 19/09/2025
    """
    rules = MOOD_RULES.get(mood_key) or {}
    filters = filters or {}

    include_any = rules.get("include_genres_any") or []
    with_genres = "|".join(include_any) if include_any else None
    exclude = ",".join(rules.get("exclude_genres", [])) or None

    p = {
        "watch_region": region,
        "with_watch_monetization_types": types,
        "sort_by": rules.get("sort_by", "popularity.desc"),
        "page": page,
        "include_adult": "false",
    }
    if with_genres:
        p["with_genres"] = with_genres
    if exclude:
        p["without_genres"] = exclude
    if providers:
        p["with_watch_providers"] = providers

    # Mood-level certification caps (light moods) - KR 23/09/2025
    cert_country = rules.get("cert_country")
    cert_lte     = rules.get("cert_lte")
    if cert_country and cert_lte:
        p["certification_country"] = cert_country
        p["certification.lte"]     = cert_lte

    #  Filters from request - KR 23/09/2025
    if filters.get("year_from"):
        p["primary_release_date.gte"] = f"{filters['year_from']}-01-01"
    if filters.get("year_to"):
        p["primary_release_date.lte"] = f"{filters['year_to']}-12-31"
    if filters.get("vote_average_gte") is not None:
        p["vote_average.gte"] = str(filters["vote_average_gte"])

    req_min_votes = filters.get("min_votes") or 0
    mood_floor    = rules.get("min_votes_floor") or 0
    min_votes     = max(req_min_votes, mood_floor)
    if min_votes:
        p["vote_count.gte"] = str(min_votes)

    if filters.get("runtime_gte"):
        p["with_runtime.gte"] = str(filters["runtime_gte"])
    if filters.get("runtime_lte"):
        p["with_runtime.lte"] = str(filters["runtime_lte"])
    if filters.get("lang"):
        p["with_original_language"] = filters["lang"]
    if filters.get("sort_by"):
        p["sort_by"] = filters["sort_by"]

    return p

# expose setters for admin endpoints - KR 23/09/2025
def set_pins_overrides(patch: dict):
    pins_ov = _get_overrides(_OVR_PINS_KEY)
    for mood, ids in patch.items():
        pins_ov[mood] = [int(x) for x in (ids or [])]
    _set_overrides(_OVR_PINS_KEY, pins_ov)

def set_keywords_overrides(patch: dict):
    kw_ov = _get_overrides(_OVR_KEYWORDS_KEY)
    for mood, kws in patch.items():
        kw_ov[mood] = [str(x) for x in (kws or [])]
    _set_overrides(_OVR_KEYWORDS_KEY, kw_ov)