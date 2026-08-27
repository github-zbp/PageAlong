import importlib.util
from pathlib import Path


def test_s3_compatible_upload_records_metadata_and_public_url(tmp_path):
    spec = importlib.util.find_spec("app.services.object_storage")
    assert spec is not None

    from app.services.object_storage import ObjectStorageService

    source = tmp_path / "course.wav"
    source.write_bytes(b"audio-bytes")
    captured = {}

    class FakeS3Client:
        def put_object(self, **kwargs):
            captured.update(kwargs)
            return {"ETag": '"etag-1"'}

    service = ObjectStorageService(
        backend="r2",
        bucket="pagealong-media",
        endpoint_url="https://account.r2.cloudflarestorage.com",
        access_key_id="access",
        secret_access_key="secret",
        public_base_url="https://media.pagealong.com/assets",
        local_root=tmp_path / "local",
        client_factory=lambda: FakeS3Client(),
    )

    stored = service.upload_file(
        source,
        object_key="audio/course_1/audio_1.wav",
        content_type="audio/wav",
    )

    assert captured["Bucket"] == "pagealong-media"
    assert captured["Key"] == "audio/course_1/audio_1.wav"
    assert captured["Body"] == b"audio-bytes"
    assert captured["ContentType"] == "audio/wav"
    assert captured["CacheControl"] == "public, max-age=31536000, immutable"
    assert stored.storage_backend == "r2"
    assert stored.bucket == "pagealong-media"
    assert stored.object_key == "audio/course_1/audio_1.wav"
    assert stored.object_path == "https://media.pagealong.com/assets/audio/course_1/audio_1.wav"
    assert stored.content_type == "audio/wav"
    assert stored.byte_size == len(b"audio-bytes")
    assert stored.etag == '"etag-1"'
    assert len(stored.checksum_sha256) == 64


def test_local_upload_copies_file_and_records_metadata(tmp_path):
    spec = importlib.util.find_spec("app.services.object_storage")
    assert spec is not None

    from app.services.object_storage import ObjectStorageService

    source = tmp_path / "image.webp"
    source.write_bytes(b"image-bytes")
    service = ObjectStorageService(
        backend="local",
        bucket="local",
        endpoint_url="",
        access_key_id="",
        secret_access_key="",
        public_base_url="",
        local_root=tmp_path / "media",
    )

    stored = service.upload_file(
        source,
        object_key="articles/course_1/images/hash.webp",
        content_type="image/webp",
    )

    copied = Path(stored.object_path)
    assert copied.exists()
    assert copied.read_bytes() == b"image-bytes"
    assert stored.storage_backend == "local"
    assert stored.object_key == "articles/course_1/images/hash.webp"
    assert stored.content_type == "image/webp"
    assert stored.byte_size == len(b"image-bytes")
    assert len(stored.checksum_sha256) == 64


def test_local_object_storage_can_round_trip_raw_bytes(tmp_path):
    from app.services.object_storage import ObjectStorageService

    service = ObjectStorageService(
        backend="local",
        bucket="local",
        endpoint_url="",
        access_key_id="",
        secret_access_key="",
        public_base_url="",
        local_root=tmp_path / "imports",
    )
    stored = service.upload_bytes(b"raw-bytes", object_key="imports/a.txt", content_type="text/plain")

    assert service.download_bytes(stored.object_path) == b"raw-bytes"


def test_s3_compatible_delete_uses_bucket_and_key(tmp_path):
    from app.services.object_storage import ObjectStorageService

    captured = {}

    class FakeS3Client:
        def delete_object(self, **kwargs):
            captured.update(kwargs)

    service = ObjectStorageService(
        backend="r2",
        bucket="pagealong-media",
        endpoint_url="https://account.r2.cloudflarestorage.com",
        access_key_id="access",
        secret_access_key="secret",
        public_base_url="https://media.pagealong.com/assets",
        local_root=tmp_path / "local",
        client_factory=lambda: FakeS3Client(),
    )

    service.delete_object("audio/course_1/audio_1.wav")

    assert captured == {"Bucket": "pagealong-media", "Key": "audio/course_1/audio_1.wav"}


def test_local_delete_removes_file(tmp_path):
    from app.services.object_storage import ObjectStorageService

    source = tmp_path / "media" / "audio" / "course_1" / "audio_1.wav"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"audio-bytes")

    service = ObjectStorageService(
        backend="local",
        bucket="local",
        endpoint_url="",
        access_key_id="",
        secret_access_key="",
        public_base_url="",
        local_root=tmp_path / "media",
    )

    service.delete_object("audio/course_1/audio_1.wav")

    assert not source.exists()
