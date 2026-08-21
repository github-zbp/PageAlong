from celery import Celery

from app.core.config import settings

celery_client = Celery("web_reader_api", broker=settings.redis_url, backend=settings.redis_url)
celery_client.conf.update(
    broker_transport_options={"global_keyprefix": settings.redis_key_prefix},
    result_backend_transport_options={"global_keyprefix": settings.redis_key_prefix},
)


def enqueue_audio_generation(course_id: str, job_id: str) -> str:
    result = celery_client.send_task("generate_audio_for_course", args=[course_id, job_id])
    return result.id


def enqueue_url_import(course_id: str, job_id: str) -> str:
    result = celery_client.send_task("import_url_for_course", args=[course_id, job_id])
    return result.id
