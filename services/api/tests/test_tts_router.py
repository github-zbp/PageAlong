from app.services.tts_router import ProviderHealth, TTSRouter
from app.services.tts_segments import split_text_for_tencent, tencent_speed_for_factor


def test_router_chooses_edge_for_free_user():
    route = TTSRouter(paid_user_ids={"paid_user"}).route_for_user(
        user_id="free_user",
        estimated_characters=100,
        provider_health=ProviderHealth(),
    )

    assert route.tier == "free"
    assert route.provider_id == "edge_tts"
    assert route.fallback_provider_id == "kokoro_onnx_cpu"


def test_router_chooses_tencent_for_paid_user():
    route = TTSRouter(paid_user_ids={"paid_user"}).route_for_user(
        user_id="paid_user",
        estimated_characters=100,
        provider_health=ProviderHealth(),
    )

    assert route.tier == "paid"
    assert route.provider_id == "tencent_cloud_tts"
    assert route.fallback_provider_id == "aws_polly_standard"


def test_router_chooses_aws_when_tencent_capacity_is_full():
    route = TTSRouter(paid_user_ids={"paid_user"}).route_for_user(
        user_id="paid_user",
        estimated_characters=100,
        provider_health=ProviderHealth(tencent_capacity_available=False),
    )

    assert route.tier == "paid"
    assert route.provider_id == "aws_polly_standard"
    assert route.fallback_provider_id is None


def test_tencent_speed_mapping_uses_integer_provider_values():
    assert tencent_speed_for_factor(0.8) == -1
    assert tencent_speed_for_factor(1.0) == 0
    assert tencent_speed_for_factor(1.25) == 1
    assert tencent_speed_for_factor(1.5) == 2
    assert tencent_speed_for_factor(2.0) == 4


def test_tencent_chinese_segments_stay_under_conservative_limit():
    text = "学" * 900

    segments = split_text_for_tencent(text, max_chinese_chars=560, max_english_letters=1600)

    assert [len(segment) for segment in segments] == [560, 340]
