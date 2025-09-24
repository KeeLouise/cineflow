from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from api.services.tmdb import cache_get, cache_set, midnight_ttl_seconds, collect_discover_pages
from api.services.mood import (
    MOOD_RULES,
    effective_pins_for,
    effective_keywords_for,
    set_pins_overrides,
    set_keywords_overrides,
    build_discover_params,
)

@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def moods_config(request):
    # GET current config
    if request.method == "GET":
        moods = sorted(MOOD_RULES.keys())
        data = {
            "moods": moods,
            "pins": { m: {"effective": effective_pins_for(m)} for m in moods },
            "keywords": { m: {"effective": effective_keywords_for(m)} for m in moods },
        }
        return Response(data, status=200)

    # POST: update overrides
    pins_patch = request.data.get("pins") or {}
    kw_patch   = request.data.get("keywords") or {}
    if not isinstance(pins_patch, dict) or not isinstance(kw_patch, dict):
        return Response({"detail": "pins and keywords must be objects"}, status=400)

    for mood in list(pins_patch.keys()) + list(kw_patch.keys()):
        if mood not in MOOD_RULES:
            return Response({"detail": f"Unknown mood '{mood}'"}, status=400)

    set_pins_overrides(pins_patch)
    set_keywords_overrides(kw_patch)
    return Response({"ok": True}, status=200)

@api_view(["POST"])
@permission_classes([IsAdminUser])  # admin-only control surface - KR 02/09/2025
def mood_refresh_snapshot(request):
    """
    Force refresh (or purge) the daily snapshot for a mood.
    """
    mood_key = (request.data.get("mood") or request.query_params.get("mood") or "").strip()
    if mood_key not in MOOD_RULES:
        return Response({"detail": f"Unknown mood '{mood_key}'"}, status=400)

    region    = (request.data.get("region") or request.query_params.get("region") or "GB").strip()
    providers = (request.data.get("providers") or request.query_params.get("providers") or "").strip()
    types_in  = (request.data.get("types") or request.query_params.get("types") or "flatrate,ads,free").strip()
    broad     = (request.data.get("broad") or request.query_params.get("broad") or "").lower() in ("1", "true", "yes")
    purge     = (request.data.get("purge") or request.query_params.get("purge") or "").lower() in ("1", "true", "yes")

    filters = {
        "year_from": None, "year_to": None, "vote_average_gte": None,
        "min_votes": None, "runtime_gte": None, "runtime_lte": None,
        "lang": None, "sort_by": None,
    }

    base = build_discover_params(mood_key, region=region, providers=providers, types=types_in, page=1, filters=filters)
    if broad or providers:
        base = dict(base)
        base["with_watch_monetization_types"] = "ads,buy,flatrate,free,rent"

    variants = [("strict", dict(base))]
    if base.get("with_watch_monetization_types") != "ads,buy,flatrate,free,rent":
        wide = dict(base); wide["with_watch_monetization_types"] = "ads,buy,flatrate,free,rent"
        variants.append(("strict_wide", wide))

    def _snapkey(bucket, par):
        ftag = "y- --rt- -mv- -lg- -sb- -va-"
        return f"snap3:{bucket}:{mood_key}:{region}:{par.get('with_watch_providers','-')}:{par.get('with_watch_monetization_types','-')}:{ftag}:v1"

    keys, sizes = [], []
    for name, params in variants:
        k = _snapkey(name, params)
        keys.append(k)
        if purge:
            from django.core.cache import cache
            cache.delete(k)
            sizes.append(0)
        else:
            snap = collect_discover_pages({**params, "page": 1}, max_pages=5)
            cache_set(k, snap, midnight_ttl_seconds())
            sizes.append(len(snap.get("results", [])))

    return Response({"refreshed": (not purge), "purged": purge, "keys": keys, "sizes": sizes,
                     "mood": mood_key, "region": region}, status=200)

@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def mood_keywords_mutate(request):
    """
    GET  ?mood=feelgood -> returns effective lists
    POST { "mood":"feelgood", "add":["123","456"] } OR { "mood":"feelgood", "remove":["123"] }
    """
    from api.services.mood import effective_keywords_for, _OVR_KEYWORDS_KEY
    from django.core.cache import cache

    if request.method == "GET":
        mood = (request.query_params.get("mood") or "").strip()
        if mood not in MOOD_RULES:
            return Response({"detail": f"Unknown mood '{mood}'"}, status=400)
        return Response({"mood": mood, "effective": effective_keywords_for(mood)}, status=200)

    mood = (request.data.get("mood") or "").strip()
    if mood not in MOOD_RULES:
        return Response({"detail": f"Unknown mood '{mood}'"}, status=400)

    add = request.data.get("add") or []
    rem = request.data.get("remove") or []

    kw_ov = cache.get(_OVR_KEYWORDS_KEY) or {}
    cur = [str(x) for x in kw_ov.get(mood, [])]

    if add:
        for kw in add:
            kw = str(kw)
            if kw not in cur:
                cur.insert(0, kw)
    if rem:
        rem_set = {str(x) for x in rem}
        cur = [x for x in cur if x not in rem_set]

    kw_ov[mood] = cur
    cache.set(_OVR_KEYWORDS_KEY, kw_ov, 60 * 60 * 24 * 30)
    return Response({"effective": effective_keywords_for(mood), "override": cur}, status=200)

@api_view(["POST"])
@permission_classes([IsAdminUser])
def mood_pins_mutate(request):
    """
    Add/remove a single pinned movie ID for a mood.
    """
    from api.services.mood import effective_pins_for, _OVR_PINS_KEY
    from django.core.cache import cache

    mood = (request.data.get("mood") or "").strip()
    if mood not in MOOD_RULES:
        return Response({"detail": f"Unknown mood '{mood}'"}, status=400)

    add = request.data.get("add")
    rem = request.data.get("remove")

    pins_ov = cache.get(_OVR_PINS_KEY) or {}
    cur = pins_ov.get(mood, [])[:]

    if add is not None:
        add = int(add)
        if add not in cur:
            cur.insert(0, add)
    if rem is not None:
        rem = int(rem)
        cur = [x for x in cur if x != rem]

    pins_ov[mood] = cur
    cache.set(_OVR_PINS_KEY, pins_ov, 60 * 60 * 24 * 30)
    return Response({"effective": effective_pins_for(mood), "override": cur}, status=200)

@api_view(["POST"])
@permission_classes([IsAdminUser])
def mood_seed_from_movie(request):
    """
    Seed a mood's keyword overrides from a TMDB movie's keywords
    """
    from api.services.mood import effective_keywords_for, _OVR_KEYWORDS_KEY
    from django.core.cache import cache
    from api.services.tmdb import tmdb_get

    mood = (request.data.get("mood") or "").strip()
    if mood not in MOOD_RULES:
        return Response({"detail": f"Unknown mood '{mood}'"}, status=400)

    tmdb_id = request.data.get("tmdb_id")
    title   = (request.data.get("title") or "").strip()
    limit   = int(request.data.get("limit") or 15)
    region  = (request.data.get("region") or "GB").strip()

    if not tmdb_id and not title:
        return Response({"detail": "Provide tmdb_id or title"}, status=400)

    if not tmdb_id:
        srch, err = tmdb_get("/search/movie", {"query": title})
        if err:
            return err
        top = ((srch or {}).get("results") or [])
        if not top:
            return Response({"detail": f"No TMDB results for title '{title}'"}, status=404)
        tmdb_id = top[0].get("id")

    kw_data, err2 = tmdb_get(f"/movie/{tmdb_id}/keywords")
    if err2:
        return err2

    kws = (kw_data or {}).get("keywords") or []
    picked_ids = [str(k.get("id")) for k in kws if k.get("id")][:max(1, limit)]
    if not picked_ids:
        return Response({"detail": f"No keywords found for movie id {tmdb_id}"}, status=404)

    kw_ov = cache.get(_OVR_KEYWORDS_KEY) or {}
    cur = [str(x) for x in kw_ov.get(mood, [])]
    for kw in picked_ids[::-1]:
        if kw not in cur:
            cur.insert(0, kw)
    kw_ov[mood] = cur
    cache.set(_OVR_KEYWORDS_KEY, kw_ov, 60 * 60 * 24 * 30)

    return Response({
        "mood": mood,
        "tmdb_id": tmdb_id,
        "added_keywords": picked_ids,
        "effective_keywords": effective_keywords_for(mood),
    }, status=200)

@api_view(["POST"])
@permission_classes([IsAdminUser])
def clear_all_snapshots(request):
    """
    Remove cached mood snapshot entries (best-effort).
    """
    from django.core.cache import cache
    deleted = 0
    mode = "pattern"
    iter_keys = getattr(cache, "iter_keys", None)

    try:
        if callable(iter_keys):
            for pref in ("snap3:", "snap2f:"):
                for key in cache.iter_keys(f"{pref}*"):
                    if cache.delete(key):
                        deleted += 1
        else:
            cache.clear()
            mode = "cleared_all"
    except Exception:
        cache.clear()
        mode = "cleared_all"

    return Response({"deleted": deleted, "mode": mode}, status=200)