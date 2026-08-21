import pytest

from app.services.url_safety import UnsafeUrlError, validate_public_http_url


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "http://localhost:8000/secret",
        "http://127.0.0.1:8000/secret",
        "http://10.0.0.1/admin",
        "http://172.16.0.1/admin",
        "http://192.168.1.1/admin",
        "http://100.64.0.1/admin",
        "http://169.254.169.254/latest/meta-data",
    ],
)
def test_validate_public_http_url_rejects_unsafe_targets(monkeypatch, url):
    host = url.split("//", 1)[1].split("/", 1)[0].split(":", 1)[0]
    monkeypatch.setattr("app.services.url_safety.resolve_host_ips", lambda resolved_host: [host])

    with pytest.raises(UnsafeUrlError):
        validate_public_http_url(url)


def test_validate_public_http_url_allows_public_http_url(monkeypatch):
    monkeypatch.setattr("app.services.url_safety.resolve_host_ips", lambda host: ["93.184.216.34"])

    result = validate_public_http_url("https://example.com/article#comments")

    assert result.url == "https://example.com/article"


def test_validate_public_http_url_returns_resolved_public_ips(monkeypatch):
    monkeypatch.setattr("app.services.url_safety.resolve_host_ips", lambda host: ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"])

    result = validate_public_http_url("https://example.com/article")

    assert result.url == "https://example.com/article"
    assert result.hostname == "example.com"
    assert result.port == 443
    assert result.ip_addresses == ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]
