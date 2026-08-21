import httpx
import pytest

from app.services.url_safety import ResolvedPublicUrl
from app.services.web_fetcher import FetchResult, WebFetchError, fetch_public_html


def resolved(url: str) -> ResolvedPublicUrl:
    parsed = httpx.URL(url)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    path = parsed.raw_path.decode("ascii")
    return ResolvedPublicUrl(
        url=url,
        scheme=parsed.scheme,
        hostname=parsed.host,
        port=port,
        path=path or "/",
        host_header=parsed.host if parsed.port is None else f"{parsed.host}:{parsed.port}",
        ip_addresses=["93.184.216.34"],
    )


def test_fetch_public_html_returns_text_and_metadata(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"content-type": "text/html"}, text="<html><body>正文</body></html>")

    monkeypatch.setattr("app.services.web_fetcher.validate_public_http_url", resolved)

    result = fetch_public_html(
        "https://example.com/article",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert isinstance(result, FetchResult)
    assert result.status_code == 200
    assert result.final_url == "https://example.com/article"
    assert result.content_type == "text/html"
    assert "正文" in result.html


def test_fetch_public_html_maps_http_403_to_fetch_error(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, text="Forbidden")

    monkeypatch.setattr("app.services.web_fetcher.validate_public_http_url", resolved)

    with pytest.raises(WebFetchError) as exc_info:
        fetch_public_html(
            "https://example.com/private",
            client=httpx.Client(transport=httpx.MockTransport(handler)),
        )

    assert exc_info.value.code == "http_403"


def test_fetch_public_html_follows_public_redirects_after_validation(monkeypatch):
    requested_urls = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested_urls.append(str(request.url))
        if str(request.url) == "https://example.com/start":
            return httpx.Response(302, headers={"location": "https://example.org/final"})
        return httpx.Response(200, headers={"content-type": "text/html"}, text="<article>正文</article>")

    monkeypatch.setattr("app.services.web_fetcher.validate_public_http_url", resolved)

    result = fetch_public_html(
        "https://example.com/start",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert requested_urls == ["https://example.com/start", "https://example.org/final"]
    assert result.final_url == "https://example.org/final"
    assert "正文" in result.html


def test_fetch_public_html_rejects_unsafe_redirect_before_following(monkeypatch):
    requested_urls = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested_urls.append(str(request.url))
        if "127.0.0.1" in str(request.url):
            return httpx.Response(200, text="private")
        return httpx.Response(302, headers={"location": "http://127.0.0.1/private"})

    def validate(url: str) -> ResolvedPublicUrl:
        if "127.0.0.1" in url:
            from app.services.url_safety import UnsafeUrlError

            raise UnsafeUrlError("Private network URLs are not allowed", code="private_network")
        return resolved(url)

    monkeypatch.setattr("app.services.web_fetcher.validate_public_http_url", validate)

    with pytest.raises(WebFetchError) as exc_info:
        fetch_public_html(
            "https://example.com/start",
            client=httpx.Client(transport=httpx.MockTransport(handler)),
        )

    assert requested_urls == ["https://example.com/start"]
    assert exc_info.value.code == "private_network"


def test_fetch_public_html_default_path_uses_validated_ip_not_second_dns_resolution(monkeypatch):
    monkeypatch.setattr(
        "app.services.web_fetcher.validate_public_http_url",
        lambda url: ResolvedPublicUrl(
            url=url,
            scheme="http",
            hostname="rebind.example",
            port=80,
            path="/article",
            host_header="rebind.example",
            ip_addresses=["93.184.216.34"],
        ),
    )

    def fake_fetch(resolved_url, timeout_seconds, max_bytes):
        assert resolved_url.ip_addresses == ["93.184.216.34"]
        return httpx.Response(200, request=httpx.Request("GET", resolved_url.url), text="<article>ok</article>")

    monkeypatch.setattr("app.services.web_fetcher.fetch_resolved_url", fake_fetch)

    result = fetch_public_html("http://rebind.example/article")

    assert result.html == "<article>ok</article>"


def test_fetch_resolved_url_stops_before_reading_more_than_max_bytes(monkeypatch):
    from app.services.web_fetcher import fetch_resolved_url

    class FakeResponse:
        status = 200
        headers = {"Content-Type": "text/html"}

        def read(self, size):
            return b"x" * size

    class FakeConnection:
        def __init__(self, ip_address, port, timeout):
            self.ip_address = ip_address
            self.port = port
            self.timeout = timeout

        def request(self, method, target, headers):
            assert method == "GET"
            assert target == "/large"
            assert headers["Host"] == "example.com"

        def getresponse(self):
            return FakeResponse()

        def close(self):
            pass

    monkeypatch.setattr("app.services.web_fetcher.http.client.HTTPConnection", FakeConnection)

    resolved = ResolvedPublicUrl(
        url="http://example.com/large",
        scheme="http",
        hostname="example.com",
        port=80,
        path="/large",
        host_header="example.com",
        ip_addresses=["93.184.216.34"],
    )

    with pytest.raises(WebFetchError) as exc_info:
        fetch_resolved_url(resolved, timeout_seconds=1, max_bytes=8)

    assert exc_info.value.code == "response_too_large"
