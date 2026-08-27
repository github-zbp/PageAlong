import subprocess
import sys


def test_worker_app_registers_tasks_on_startup():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "from app.celery_app import celery_app; "
                "print('generate_audio_for_course' in celery_app.tasks); "
                "print('import_url_for_course' in celery_app.tasks); "
                "print('import_file_for_course' in celery_app.tasks); "
                "print('run_generation_job' in celery_app.tasks)"
            ),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout.strip().splitlines() == ["True", "True", "True", "True"]
