from app.core.config import settings
from app.services.content_metrics import TextContentMetric, word_count_unit_label
from app.services.tts_types import TTSRoutePlan


class TTSGenerationLimitExceeded(ValueError):
    pass


class TTSCharacterLimitExceeded(TTSGenerationLimitExceeded):
    pass


class TTSDailyCourseLimitExceeded(TTSGenerationLimitExceeded):
    pass


def enforce_route_character_limit(route: TTSRoutePlan, estimated_characters: int) -> None:
    estimated_metric = TextContentMetric(
        count=estimated_characters,
        unit="characters",
        estimated_reading_seconds=0,
    )
    enforce_route_metric_limit(route, estimated_metric)


def enforce_route_metric_limit(route: TTSRoutePlan, metric: TextContentMetric) -> None:
    if route.tier == "free" and metric.count > settings.free_tts_max_course_characters:
        raise TTSCharacterLimitExceeded(
            f"课程内容超过了 {settings.free_tts_max_course_characters} 个"
            f"{word_count_unit_label(metric.unit)}（免费版单次音频生成上限）"
        )
    if route.tier == "paid" and metric.count > settings.paid_tts_max_auto_characters:
        raise TTSCharacterLimitExceeded(
            f"课程内容超过了 {settings.paid_tts_max_auto_characters} 个"
            f"{word_count_unit_label(metric.unit)}（付费版自动音频生成上限）"
        )
