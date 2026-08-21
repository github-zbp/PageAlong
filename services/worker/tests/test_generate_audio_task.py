from app.tasks.generate_audio import build_timeline_payload
from app.tasks.generate_audio import generate_audio_for_course
from app.tasks import generate_audio as generate_audio_module
from app.celery_app import load_project_env_file
from app.celery_app import celery_app


def test_build_timeline_payload_serializes_sentence_timings():
    payload = build_timeline_payload(
        [{"index": 0, "text": "第一句。"}, {"index": 1, "text": "第二句。"}],
        [(0, 0.0, 0.8), (1, 0.8, 1.6)],
    )

    assert payload == [
        {"index": 0, "text": "第一句。", "audio_start_seconds": 0.0, "audio_end_seconds": 0.8},
        {"index": 1, "text": "第二句。", "audio_start_seconds": 0.8, "audio_end_seconds": 1.6},
    ]


def test_worker_celery_app_prefixes_redis_keys():
    assert celery_app.conf.broker_transport_options["global_keyprefix"] == "web_reader:"
    assert celery_app.conf.result_backend_transport_options["global_keyprefix"] == "web_reader:"


def test_worker_loads_project_env_file_without_overriding_existing_environment(monkeypatch, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "REDIS_URL=redis://from-root-env:6379/0",
                "REDIS_KEY_PREFIX=from-root:",
                "FREE_TTS_MAX_COURSE_CHARACTERS=30000",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("REDIS_URL", "redis://already-set:6379/0")
    monkeypatch.delenv("REDIS_KEY_PREFIX", raising=False)
    monkeypatch.delenv("FREE_TTS_MAX_COURSE_CHARACTERS", raising=False)

    load_project_env_file(env_file)

    assert load_project_env_file(env_file) == env_file
    assert generate_audio_module.os.environ["REDIS_URL"] == "redis://already-set:6379/0"
    assert generate_audio_module.os.environ["REDIS_KEY_PREFIX"] == "from-root:"
    assert generate_audio_module.os.environ["FREE_TTS_MAX_COURSE_CHARACTERS"] == "30000"


def test_generate_audio_task_calls_api_cli_subprocess(monkeypatch):
    captured = {}

    class FakeCompletedProcess:
        stdout = '{"course_id":"course_1","job_id":"job_1","status":"succeeded"}'
        stderr = ""

    def fake_run(command, *, cwd, env, check, capture_output, text):
        captured["command"] = command
        captured["cwd"] = str(cwd)
        captured["pythonpath"] = env["PYTHONPATH"]
        captured["check"] = check
        captured["capture_output"] = capture_output
        captured["text"] = text
        return FakeCompletedProcess()

    monkeypatch.setenv("API_CLI_PYTHON", "/tmp/api-python")
    monkeypatch.setattr(generate_audio_module.subprocess, "run", fake_run)

    result = generate_audio_for_course.run("course_1", "job_1")

    assert captured["command"] == ["/tmp/api-python", "-m", "app.cli.generate_audio", "job_1"]
    assert captured["cwd"].endswith("services/api")
    assert captured["pythonpath"].endswith("services/api")
    assert captured["check"] is True
    assert captured["capture_output"] is True
    assert captured["text"] is True
    assert result == {"course_id": "course_1", "job_id": "job_1", "status": "succeeded"}
