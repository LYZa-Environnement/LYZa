from app.rules import (
    level_from_argiles,
    level_from_count,
    level_from_flood_signals,
    level_from_radon,
    level_from_ssp,
    level_from_zonage_sismique,
)


def test_level_from_count_thresholds():
    assert level_from_count(None) == "indeterminee"
    assert level_from_count(0) == "faible"
    assert level_from_count(1) == "moderee"
    assert level_from_count(3) == "moderee"
    assert level_from_count(4) == "elevee"


def test_level_from_ssp_any_hit_is_high():
    assert level_from_ssp(None) == "indeterminee"
    assert level_from_ssp(0) == "faible"
    assert level_from_ssp(1) == "elevee"


def test_level_from_zonage_sismique():
    assert level_from_zonage_sismique(None) == "indeterminee"
    assert level_from_zonage_sismique(1) == "faible"
    assert level_from_zonage_sismique(2) == "faible"
    assert level_from_zonage_sismique(3) == "moderee"
    assert level_from_zonage_sismique(5) == "elevee"


def test_level_from_argiles():
    assert level_from_argiles(None) == "indeterminee"
    assert level_from_argiles("Faible") == "faible"
    assert level_from_argiles("Moyen") == "moderee"
    assert level_from_argiles("Fort") == "elevee"
    assert level_from_argiles("inconnu") == "indeterminee"


def test_level_from_radon():
    assert level_from_radon(None) == "indeterminee"
    assert level_from_radon(1) == "faible"
    assert level_from_radon(2) == "moderee"
    assert level_from_radon(3) == "elevee"


def test_level_from_flood_signals():
    assert level_from_flood_signals(None, None) == "indeterminee"
    assert level_from_flood_signals(False, 0) == "faible"
    assert level_from_flood_signals(True, 1) == "elevee"
    assert level_from_flood_signals(True, 0) == "moderee"
    assert level_from_flood_signals(False, 3) == "moderee"
    assert level_from_flood_signals(False, 1) == "moderee"
