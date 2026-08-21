import re
import wave
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SentenceTiming:
    sentence_index: int
    start_seconds: float
    end_seconds: float


@dataclass(frozen=True)
class SynthesisResult:
    provider: str
    audio_path: Path
    duration_seconds: int
    character_count: int
    timeline: list[SentenceTiming]


class FakeTTSProvider:
    provider = "fake"

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def synthesize_article(
        self,
        course_id: str,
        sentences: list[str],
        voice_id: str,
        speed: float,
    ) -> SynthesisResult:
        sample_rate = 8_000
        timeline: list[SentenceTiming] = []
        frames = bytearray()
        cursor = 0.0

        for index, sentence in enumerate(sentences):
            billable_length = len(_countable_text(sentence))
            duration = max(0.6, billable_length * 0.12 / max(speed, 0.5))
            frame_count = int(sample_rate * duration)
            frames.extend(b"\x00\x00" * frame_count)
            timeline.append(SentenceTiming(index, round(cursor, 3), round(cursor + duration, 3)))
            cursor += duration

        audio_path = self.output_dir / f"{course_id}.wav"
        with wave.open(str(audio_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(bytes(frames))

        return SynthesisResult(
            provider=self.provider,
            audio_path=audio_path,
            duration_seconds=max(1, round(cursor)),
            character_count=sum(len(_countable_text(sentence)) for sentence in sentences),
            timeline=timeline,
        )


def _countable_text(text: str) -> str:
    return re.sub(r"[\s。！？!?？,.，、；;：:\"'“”‘’（）()《》<>]", "", text)

