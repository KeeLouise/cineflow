import pytest
from api.services.mood import passes_genre_gate, build_discover_params

def test_feelgood_rejects_horror():
    movie = {"genre_ids": [27, 35]}  # horror + comedy - KR
    assert passes_genre_gate("feelgood", movie) is False

def test_build_params_has_cert_caps_for_light_moods():
    p = build_discover_params("feelgood", region="GB", providers="", page=1, filters={})
    assert p.get("certification_country") == "US"
    assert p.get("certification.lte") == "PG-13"