from app.tasks.import_file import import_file_for_course
from app.tasks import import_file as import_file_module


def test_import_file_task_calls_api_cli_subprocess(monkeypatch):
    captured = {}

    class FakeCompletedProcess:
        stdout = '{"item_id":"item_1","status":"succeeded"}'
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
    monkeypatch.setattr(import_file_module.subprocess, "run", fake_run)

    result = import_file_for_course.run("course_1", "item_1")

    assert captured["command"] == ["/tmp/api-python", "-m", "app.cli.import_file", "item_1"]
    assert captured["cwd"].endswith("services/api")
    assert captured["pythonpath"].endswith("services/api")
    assert captured["check"] is True
    assert captured["capture_output"] is True
    assert captured["text"] is True
    assert result == {"course_id": "course_1", "item_id": "item_1", "status": "succeeded"}
