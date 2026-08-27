from app.tasks import run_job as run_job_module
from app.tasks.run_job import run_generation_job


def test_run_generation_job_task_calls_api_cli_subprocess(monkeypatch):
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
    monkeypatch.setattr(run_job_module.subprocess, "run", fake_run)

    result = run_generation_job.run("job_1")

    assert captured["command"] == ["/tmp/api-python", "-m", "app.cli.run_job", "job_1"]
    assert captured["cwd"].endswith("services/api")
    assert captured["pythonpath"].endswith("services/api")
    assert captured["check"] is True
    assert captured["capture_output"] is True
    assert captured["text"] is True
    assert result == {"course_id": "course_1", "job_id": "job_1", "status": "succeeded"}
