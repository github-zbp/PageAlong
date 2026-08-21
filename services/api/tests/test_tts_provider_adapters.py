from app.services.providers.aws_polly_provider import AWSPollySegmentProvider
from app.services.providers.edge_tts_provider import EdgeTTSSegmentProvider
from app.services.providers.kokoro_provider import KokoroOnnxSegmentProvider
from app.services.providers.tencent_provider import TencentCloudTTSSegmentProvider, TencentRealtimeWebSocketClient
from app.services.tts_types import TTSSegmentRequest


def test_aws_polly_provider_builds_standard_request(tmp_path):
    captured = {}

    class FakeAudioStream:
        def read(self):
            return b"aws-mp3"

    class FakePollyClient:
        def synthesize_speech(self, **kwargs):
            captured.update(kwargs)
            return {"AudioStream": FakeAudioStream()}

    provider = AWSPollySegmentProvider(output_dir=tmp_path, client=FakePollyClient(), region_name="us-east-1")
    result = provider.synthesize_segment(_request(provider_id="aws_polly_standard", voice_id="Zhiyu"))

    assert captured["Text"] == "第一句。"
    assert captured["VoiceId"] == "Zhiyu"
    assert captured["OutputFormat"] == "mp3"
    assert captured["Engine"] == "standard"
    assert result.provider_id == "aws_polly_standard"
    assert result.audio_path.read_bytes() == b"aws-mp3"


def test_edge_tts_provider_maps_speed_to_rate_and_saves_audio(tmp_path):
    captured = {}

    class FakeCommunicate:
        def __init__(self, text, voice, rate):
            captured.update({"text": text, "voice": voice, "rate": rate})

        async def stream(self):
            yield {"type": "audio", "data": b"edge-mp3"}

    provider = EdgeTTSSegmentProvider(output_dir=tmp_path, communicate_factory=FakeCommunicate)
    result = provider.synthesize_segment(_request(provider_id="edge_tts", voice_id="zh-CN-XiaoxiaoNeural", speed_factor=1.25))

    assert captured == {
        "text": "第一句。",
        "voice": "zh-CN-XiaoxiaoNeural",
        "rate": "+25%",
    }
    assert result.provider_id == "edge_tts"
    assert result.audio_path.read_bytes() == b"edge-mp3"


def test_edge_tts_provider_collects_sentence_boundary_timings(tmp_path):
    class FakeCommunicate:
        def __init__(self, text, voice, rate):
            self.text = text
            self.voice = voice
            self.rate = rate

        async def stream(self):
            yield {"type": "audio", "data": b"stream-mp3"}
            yield {
                "type": "SentenceBoundary",
                "offset": 0,
                "duration": 10_000_000,
                "text": "第一句。",
            }
            yield {
                "type": "SentenceBoundary",
                "offset": 10_000_000,
                "duration": 15_000_000,
                "text": "第二句。",
            }

        async def save(self, path):
            path.write_bytes(b"save-mp3")

    provider = EdgeTTSSegmentProvider(output_dir=tmp_path, communicate_factory=FakeCommunicate)
    result = provider.synthesize_segment(
        _request(
            provider_id="edge_tts",
            voice_id="zh-CN-XiaoxiaoNeural",
            sentence_start_index=3,
            sentence_end_index=4,
        )
    )

    assert result.audio_path.read_bytes() == b"stream-mp3"
    assert result.duration_seconds == 2.5
    assert [
        (timing.sentence_index, timing.start_seconds, timing.end_seconds)
        for timing in result.sentence_timings
    ] == [(3, 0.0, 1.0), (4, 1.0, 2.5)]


def test_tencent_provider_builds_realtime_payload(tmp_path):
    captured = {}

    class FakeTencentClient:
        def synthesize(self, payload):
            captured.update(payload)
            return b"tencent-mp3"

    provider = TencentCloudTTSSegmentProvider(
        output_dir=tmp_path,
        client=FakeTencentClient(),
        app_id="app-1",
        voice_type="101001",
        codec="mp3",
        sample_rate=16000,
    )
    result = provider.synthesize_segment(
        _request(provider_id="tencent_cloud_tts", voice_id="101001", provider_speed="1")
    )

    assert captured["AppId"] == "app-1"
    assert captured["Text"] == "第一句。"
    assert captured["SessionId"].endswith(":0")
    assert captured["VoiceType"] == 101001
    assert captured["Codec"] == "mp3"
    assert captured["SampleRate"] == 16000
    assert captured["Speed"] == 1
    assert result.provider_id == "tencent_cloud_tts"
    assert result.audio_path.read_bytes() == b"tencent-mp3"


def test_tencent_provider_constructs_signed_default_client(tmp_path):
    provider = TencentCloudTTSSegmentProvider(
        output_dir=tmp_path,
        app_id="123456",
        secret_id="secret-id",
        secret_key="secret-key",
        voice_type="101001",
        codec="mp3",
        sample_rate=16000,
    )

    client = provider.build_client(now=1234567890, nonce=42)
    signed_url = client.build_signed_url(
        {
            "AppId": "123456",
            "Text": "第一句。",
            "SessionId": "job_1:0",
            "VoiceType": 101001,
            "Codec": "mp3",
            "SampleRate": 16000,
            "Speed": 1,
        },
        now=1234567890,
        nonce=42,
    )

    assert isinstance(client, TencentRealtimeWebSocketClient)
    assert signed_url.startswith("wss://tts.cloud.tencent.com/stream_ws?")
    assert "SecretId=secret-id" in signed_url
    assert "Timestamp=1234567890" in signed_url
    assert "Nonce=42" in signed_url
    assert "Signature=" in signed_url


def test_kokoro_provider_uses_injected_cpu_client(tmp_path):
    captured = {}

    class FakeKokoroClient:
        def synthesize(self, *, text, voice, speed):
            captured.update({"text": text, "voice": voice, "speed": speed})
            return b"kokoro-wav"

    provider = KokoroOnnxSegmentProvider(output_dir=tmp_path, client=FakeKokoroClient(), voice="af")
    result = provider.synthesize_segment(_request(provider_id="kokoro_onnx_cpu", voice_id="af", response_format="wav"))

    assert captured == {"text": "第一句。", "voice": "af", "speed": 1.0}
    assert result.provider_id == "kokoro_onnx_cpu"
    assert result.audio_path.read_bytes() == b"kokoro-wav"


def test_kokoro_provider_uses_chinese_g2p_for_cjk_text(tmp_path):
    captured = {}

    class FakeChineseG2P:
        def __call__(self, text):
            captured["g2p_text"] = text
            return "ni3 hao3", None

    class FakeKokoroClient:
        def create(self, text, voice, speed, **kwargs):
            captured.update({"text": text, "voice": voice, "speed": speed, **kwargs})
            return [0.0, 0.0], 24000

    provider = KokoroOnnxSegmentProvider(
        output_dir=tmp_path,
        client=FakeKokoroClient(),
        voice="zf_xiaobei",
        chinese_g2p_factory=FakeChineseG2P,
    )

    result = provider.synthesize_segment(
        _request(provider_id="kokoro_onnx_cpu", voice_id="zf_xiaobei", response_format="wav")
    )

    assert captured["g2p_text"] == "第一句。"
    assert captured["text"] == "ni3 hao3"
    assert captured["voice"] == "zf_xiaobei"
    assert captured["speed"] == 1.0
    assert captured["is_phonemes"] is True
    assert result.provider_id == "kokoro_onnx_cpu"
    assert result.audio_path.read_bytes().startswith(b"RIFF")


def _request(
    *,
    provider_id: str,
    voice_id: str,
    speed_factor: float = 1.0,
    provider_speed: str | None = None,
    response_format: str = "mp3",
    sentence_start_index: int = 0,
    sentence_end_index: int = 0,
) -> TTSSegmentRequest:
    return TTSSegmentRequest(
        job_id="job_1",
        course_id="course_1",
        article_text_id="article_1",
        section_id="section_1",
        segment_index=0,
        sentence_start_index=sentence_start_index,
        sentence_end_index=sentence_end_index,
        text="第一句。",
        text_hash="hash_1",
        provider_id=provider_id,
        model_id="standard",
        voice_id=voice_id,
        speed_factor=speed_factor,
        provider_speed=provider_speed,
        response_format=response_format,
        idempotency_key="segment-key",
    )
