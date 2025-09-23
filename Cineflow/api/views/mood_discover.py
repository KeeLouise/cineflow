from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from api.services.tmdb import tmdb_get, cache_get, cache_set, midnight_ttl_seconds, collect_discover_pages
from api.services.mood import (
    MOOD_RULES,
    passes_genre_gate,
    build_discover_params,
    effective_pins_for,
    filter_by_providers,
)

# Filters — KR 17/09/2025
def _parse_filters_from_request(request):
    """
    Parse optional filters from query params
    """
    q = request.query_params

    # decade
    decade = (q.get("with_decade") or q.get("decade") or "").strip()
    y_from = q.get("year_from"); y_to = q.get("year_to")
    decade_map = {
        "2020s": (2020, 2029), "2010s": (2010, 2019), "2000s": (2000, 2009),
        "1990s": (1990, 1999), "1980s": (1980, 1989), "1970s": (1970, 1979), "1960s": (1960, 1969),
    }
    year_from = int(y_from) if y_from and y_from.isdigit() else None
    year_to   = int(y_to)   if y_to   and y_to.isdigit()   else None
    if decade in decade_map and (year_from is None and year_to is None):
        year_from, year_to = decade_map[decade]

    # TMDB rating
    vote_avg_gte = q.get("tmdb_min", q.get("vote_average_gte"))
    try:
        vote_avg_gte = float(vote_avg_gte) if vote_avg_gte not in (None, "", "null") else None
    except Exception:
        vote_avg_gte = None

    # helpers to keep results normal when rating is high
    min_votes = q.get("min_votes")
    try:
        min_votes = int(min_votes) if min_votes not in (None, "", "null") else None
    except Exception:
        min_votes = None
    if min_votes is None and vote_avg_gte is not None and vote_avg_gte >= 7:
        min_votes = 50

    def _int(name, lo=None, hi=None):
        val = q.get(name)
        if val is None or val == "": return None
        try:
            iv = int(val)
            if lo is not None: iv = max(lo, iv)
            if hi is not None: iv = min(hi, iv)
            return iv
        except Exception:
            return None

    runtime_gte = _int("runtime_gte", lo=40)
    runtime_lte = _int("runtime_lte", hi=240)
    lang        = (q.get("lang") or "").strip()[:5] or None
    sort_by     = (q.get("sort_by") or "").strip() or None

    return {
        "year_from": year_from,
        "year_to": year_to,
        "vote_average_gte": vote_avg_gte,
        "min_votes": min_votes,
        "runtime_gte": runtime_gte,
        "runtime_lte": runtime_lte,
        "lang": lang,
        "sort_by": sort_by,
    }

@api_view(["GET"])
@permission_classes([IsAuthenticated])  # mood is for logged in users only - KR 01/09/2025
def mood_discover(request, mood_key: str):
    """
    Mood-based discover with strict genre gating, pins, and daily snapshot stability.
    - No longer ANDs keywords at TMDB level to avoid starving results. — KR 19/09/2025
    """
    if mood_key not in MOOD_RULES:
        return Response({"detail": f"Unknown mood '{mood_key}'"}, status=400)

    region    = request.query_params.get("region", "GB")
    providers = request.query_params.get("providers", "")
    types_in  = request.query_params.get("types", "flatrate,ads,free")
    page      = max(1, int(request.query_params.get("page", "1") or 1))
    broad     = request.query_params.get("broad") in ("1", "true", "yes")
    debug     = request.query_params.get("debug") in ("1", "true", "yes")
    providers_selected = bool(providers)
    force_providers    = request.query_params.get("force_providers") in ("1", "true", "yes")

    filters = _parse_filters_from_request(request)

    # 1) Build base params (genres+excludes only; keywords omitted) — KR 19/09/2025
    base = build_discover_params(
        mood_key, region=region, providers=providers, types=types_in, page=1, filters=filters
    )

    # Allow broad monetization when requested / provider-locked
    if broad or providers_selected:
        base = dict(base)
        base["with_watch_monetization_types"] = "ads,buy,flatrate,free,rent"

    # Snapshots (strict + widened monetization variant) — KR 02/09/2025 + 19/09/2025
    def _snapshot_key(bucket_name: str, par: dict):
        f = filters
        ftag = f"y{f.get('year_from','-')}-{f.get('year_to','-')}-rt{f.get('runtime_gte','-')}-{f.get('runtime_lte','-')}-mv{f.get('min_votes','-')}-lg{f.get('lang','-')}-sb{f.get('sort_by','-')}-va{f.get('vote_average_gte','-')}"
        return (
            f"snap3:{bucket_name}:{mood_key}:{region}:"
            f"{par.get('with_watch_providers','-')}:"
            f"{par.get('with_watch_monetization_types','-')}:{ftag}:v1"
        )

    def _get_snapshot(par: dict, bucket_name: str):
        k = _snapshot_key(bucket_name, par)
        snap = cache_get(k)
        if not snap:
            snap = collect_discover_pages({**par, "page": 1}, max_pages=5)
            cache_set(k, snap, midnight_ttl_seconds())
        return snap

    strict      = dict(base)
    strict_wide = dict(base); strict_wide["with_watch_monetization_types"] = "ads,buy,flatrate,free,rent"

    snap_a = _get_snapshot(strict, "strict")
    snap_b = _get_snapshot(strict_wide, "strict_wide")

    merged = (snap_a.get("results") or []) + (snap_b.get("results") or [])

    # Dedupe, then apply strict server-side genre gate — KR 19/09/2025
    seen, candidates = set(), []
    for m in merged:
        mid = m.get("id")
        if not mid or mid in seen:
            continue
        if not passes_genre_gate(mood_key, m):
            continue
        seen.add(mid)
        candidates.append(m)

    # Sort: popularity + vote_count signal (stable) — KR 02/09/2025
    def _score(m):
        pop  = float(m.get("popularity") or 0.0)
        vcnt = int(m.get("vote_count") or 0)
        s = pop * 0.01
        if vcnt < 25: s -= 0.25
        return (-s, -pop, int(m.get("id") or 0))
    candidates.sort(key=_score)

    # Apply pins (float anchors to the top) — KR 02/09/2025
    pins = effective_pins_for(mood_key)
    order = {mid: i for i, mid in enumerate(pins)}
    existing_ids = {m.get("id") for m in candidates if m.get("id")}
    missing = [mid for mid in pins if mid not in existing_ids]

    appended = []
    for mid in missing[:5]:
        detail, err = tmdb_get(f"/movie/{mid}", {"append_to_response": "watch/providers"})
        if not err and detail:
            wp = (detail.get("watch/providers") or {}).get("results", {})
            if region in wp or "US" in wp:
                appended.append(detail)

    merged2 = candidates + appended
    def pin_key(m): return (order.get(m.get("id"), 10_000),)
    merged2.sort(key=pin_key)

    # Provider hard gate — KR 20/09/2025
    if providers and force_providers:
        merged2 = filter_by_providers(merged2, region=region, providers_csv=providers, limit_checks=60)

    # Paginate (20/page) — KR 02/09/2025
    PAGE_SIZE = 20
    start = (page - 1) * PAGE_SIZE
    end   = start + PAGE_SIZE
    total_results = len(merged2)
    total_pages   = max(1, (total_results + PAGE_SIZE - 1) // PAGE_SIZE)

    payload = {
        "page": page,
        "results": merged2[start:end],
        "total_pages": total_pages,
        "total_results": total_results,
    }

    if debug:
        payload["_mood"]    = mood_key
        payload["_filters"] = filters
        payload["_sizes"]   = {"strict": len(snap_a.get("results", []) or []),
                               "strict_wide": len(snap_b.get("results", []) or [])}
        payload["_picked_examples"] = [r.get("id") for r in merged2[:10]]
        payload["_force_providers"] = bool(force_providers)
        payload["_providers"]       = providers

    return Response(payload, status=200)