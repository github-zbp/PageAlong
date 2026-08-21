from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse


class UnsafeUrlError(ValueError):
    def __init__(self, message: str, code: str = "unsafe_url"):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ResolvedPublicUrl:
    url: str
    scheme: str
    hostname: str
    port: int
    path: str
    host_header: str
    ip_addresses: list[str]


def resolve_host_ips(hostname: str) -> list[str]:
    return list({item[4][0] for item in socket.getaddrinfo(hostname, None)})


def validate_public_http_url(url: str) -> ResolvedPublicUrl:
    parsed = urlparse(url.strip())
    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"}:
        raise UnsafeUrlError("Only http and https URLs are supported", code="invalid_scheme")
    if not parsed.hostname:
        raise UnsafeUrlError("URL must include a hostname", code="missing_hostname")

    hostname = parsed.hostname.lower()
    if hostname in {"localhost", "localhost.localdomain"}:
        raise UnsafeUrlError("Localhost URLs are not allowed", code="local_hostname")

    try:
        ip_values = resolve_host_ips(hostname)
    except socket.gaierror as exc:
        raise UnsafeUrlError("URL hostname could not be resolved", code="dns_resolution_failed") from exc

    for ip_value in ip_values:
        ip = ipaddress.ip_address(ip_value)
        if not ip.is_global or ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            raise UnsafeUrlError("Private network URLs are not allowed", code="private_network")

    port = parsed.port or (443 if scheme == "https" else 80)
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    host_header = hostname
    if parsed.port is not None and parsed.port != (443 if scheme == "https" else 80):
        host_header = f"{hostname}:{parsed.port}"
    safe_url = urlunparse(parsed._replace(scheme=scheme, fragment=""))
    return ResolvedPublicUrl(
        url=safe_url,
        scheme=scheme,
        hostname=hostname,
        port=port,
        path=path,
        host_header=host_header,
        ip_addresses=ip_values,
    )
