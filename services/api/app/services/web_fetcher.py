from __future__ import annotations

import http.client
import ssl
from dataclasses import dataclass
from time import monotonic
from urllib.parse import urljoin

import httpx

from app.services.url_safety import ResolvedPublicUrl, UnsafeUrlError, validate_public_http_url


class WebFetchError(RuntimeError):
    def __init__(self, message: str, code: str, status_code: int | None = None):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True)
class FetchResult:
    original_url: str
    final_url: str
    status_code: int
    content_type: str
    html: str
    elapsed_ms: int


def fetch_public_html(
    url: str,
    *,
    client: httpx.Client | None = None,
    timeout_seconds: float = 10.0,
    max_bytes: int = 2_000_000,
    max_redirects: int = 5,
) -> FetchResult:
    started = monotonic()
    try:
        safe_url = validate_public_http_url(url)
    except UnsafeUrlError as exc:
        raise WebFetchError(str(exc), code=exc.code) from exc

    owns_client = client is None
    active_client = client
    try:
        current_url = safe_url
        response: httpx.Response | None = None
        for _ in range(max_redirects + 1):
            response = (
                active_client.get(current_url.url, headers={"User-Agent": "PageAlongBot/0.1"})
                if active_client is not None
                else fetch_resolved_url(current_url, timeout_seconds=timeout_seconds, max_bytes=max_bytes)
            )
            if response.status_code not in {301, 302, 303, 307, 308}:
                break
            location = response.headers.get("location")
            if not location:
                break
            try:
                current_url = validate_public_http_url(urljoin(current_url.url, location))
            except UnsafeUrlError as exc:
                raise WebFetchError(str(exc), code=exc.code) from exc
        else:
            raise WebFetchError("URL redirected too many times", code="too_many_redirects")

        if response is None:
            raise WebFetchError("Fetching URL failed", code="fetch_error")

        final_url = validate_public_http_url(str(response.url))

        if response.status_code >= 400:
            raise WebFetchError(
                f"URL returned HTTP {response.status_code}",
                code=f"http_{response.status_code}",
                status_code=response.status_code,
            )
        if len(response.content) > max_bytes:
            raise WebFetchError("Fetched page exceeds maximum supported size", code="response_too_large")

        return FetchResult(
            original_url=safe_url.url,
            final_url=final_url.url,
            status_code=response.status_code,
            content_type=response.headers.get("content-type", ""),
            html=response.text,
            elapsed_ms=round((monotonic() - started) * 1000),
        )
    except httpx.TimeoutException as exc:
        raise WebFetchError("Fetching URL timed out", code="fetch_timeout") from exc
    except httpx.HTTPError as exc:
        raise WebFetchError(str(exc), code="fetch_error") from exc
    finally:
        if owns_client:
            active_client.close() if active_client is not None else None


def fetch_resolved_url(
    resolved_url: ResolvedPublicUrl,
    *,
    timeout_seconds: float,
    max_bytes: int,
) -> httpx.Response:
    last_error: Exception | None = None
    for ip_address in resolved_url.ip_addresses:
        connection = make_http_connection(resolved_url, ip_address, timeout_seconds)
        try:
            connection.request(
                "GET",
                resolved_url.path,
                headers={
                    "Host": resolved_url.host_header,
                    "User-Agent": "PageAlongBot/0.1",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.1",
                    "Accept-Encoding": "identity",
                    "Connection": "close",
                },
            )
            raw_response = connection.getresponse()
            body = read_limited_body(raw_response, max_bytes)
            headers = {key: value for key, value in raw_response.headers.items()}
            return httpx.Response(
                raw_response.status,
                headers=headers,
                content=body,
                request=httpx.Request("GET", resolved_url.url),
            )
        except WebFetchError:
            raise
        except (OSError, TimeoutError, http.client.HTTPException) as exc:
            last_error = exc
        finally:
            connection.close()
    raise WebFetchError(str(last_error or "Fetching URL failed"), code="fetch_error")


def make_http_connection(
    resolved_url: ResolvedPublicUrl,
    ip_address: str,
    timeout_seconds: float,
) -> http.client.HTTPConnection:
    if resolved_url.scheme == "https":
        return HostnameSNIHTTPSConnection(
            ip_address,
            resolved_url.port,
            timeout=timeout_seconds,
            server_hostname=resolved_url.hostname,
        )
    return http.client.HTTPConnection(ip_address, resolved_url.port, timeout=timeout_seconds)


class HostnameSNIHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, ip_address: str, port: int, *, timeout: float, server_hostname: str):
        super().__init__(ip_address, port=port, timeout=timeout, context=ssl.create_default_context())
        self._pagealong_server_hostname = server_hostname

    def connect(self) -> None:
        super(http.client.HTTPSConnection, self).connect()
        self.sock = self._context.wrap_socket(self.sock, server_hostname=self._pagealong_server_hostname)


def read_limited_body(raw_response: http.client.HTTPResponse, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = raw_response.read(min(65_536, max_bytes + 1 - total))
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise WebFetchError("Fetched page exceeds maximum supported size", code="response_too_large")
        chunks.append(chunk)
    return b"".join(chunks)
