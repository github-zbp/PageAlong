export function normalizeWebUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (!/^https?:$/.test(parsed.protocol)) {
      return null;
    }
    const hostname = parsed.hostname;
    const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
    const isIpv6 = hostname.includes(":");
    const isLocalhost = hostname === "localhost";
    const isDomain = hostname.includes(".");
    if (!(isDomain || isLocalhost || isIpv4 || isIpv6)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
