from celery import Celery

from app.core.config import settings

celery_client = Celery("web_reader_api", broker=settings.redis_url, backend=settings.redis_url)
celery_client.conf.update(
    broker_transport_options={"global_keyprefix": settings.redis_key_prefix},
    result_backend_transport_options={"global_keyprefix": settings.redis_key_prefix},
)


def enqueue_audio_generation(course_id: str, job_id: str) -> str:
    result = celery_client.send_task("run_generation_job", args=[job_id])
    return result.id


def enqueue_generation_job(job_id: str) -> str:
    result = celery_client.send_task("run_generation_job", args=[job_id])
    return result.id


def enqueue_url_import(course_id: str, job_id: str) -> str:
    result = celery_client.send_task("import_url_for_course", args=[course_id, job_id])
    return result.id


def enqueue_file_import(item_id: str) -> str:
    result = celery_client.send_task("import_file_for_course", args=["", item_id])
    return result.id
