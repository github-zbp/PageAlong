from app.worker_client import celery_client


def test_api_celery_client_prefixes_redis_keys():
    assert celery_client.conf.broker_transport_options["global_keyprefix"] == "web_reader:"
    assert celery_client.conf.result_backend_transport_options["global_keyprefix"] == "web_reader:"
