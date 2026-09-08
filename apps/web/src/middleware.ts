import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ANALYTICS_HEADER = "x-pagealong-public-analytics";
const APP_CHUNK_PREFIX = "/_next/static/chunks/app/";

// Middleware (edge runtime) responses such as redirects must carry an
// absolute URL: Next.js validates the Location header with `new URL(...)`
// and throws `TypeError: Invalid URL` for relative values, which turns a
// chunk reload into a 500. Derive the public origin from the forwarding
// proxy headers so browsers follow the redirect to the real site, not to
// the internal Next.js host.
function publicRequestOrigin(request: NextRequest): string {
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  const host = request.headers.get("host");
  if (host) {
    return `${forwardedProto}://${host}`;
  }
  return request.nextUrl.origin;
}

function fixDoubleEncodedAppChunk(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith(APP_CHUNK_PREFIX) || !pathname.includes("%25")) {
    return null;
  }

  const fixedPath = pathname.replace(/%25/gi, "%");
  if (fixedPath === pathname) {
    return null;
  }

  return NextResponse.redirect(
    `${publicRequestOrigin(request)}${fixedPath}${search}`,
    308
  );
}

function isMarketingPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/guide" ||
    pathname === "/download" ||
    pathname === "/story" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/")
  );
}

function isPublicFacingPath(pathname: string): boolean {
  if (isMarketingPath(pathname)) {
    return true;
  }

  if (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password") {
    return true;
  }

  if (pathname === "/en" || pathname === "/zh") {
    return true;
  }

  const localeMatch = pathname.match(/^\/(en|zh)\/([^/]+)(?:\/.*)?$/);
  if (!localeMatch) {
    return false;
  }

  const segment = localeMatch[2];
  return (
    segment === "guide" ||
    segment === "download" ||
    segment === "story" ||
    segment === "privacy" ||
    segment === "terms" ||
    segment === "blog" ||
    segment === "login" ||
    segment === "register" ||
    segment === "forgot-password"
  );
}

function englishMarketingPath(pathname: string): string {
  return pathname === "/" ? "/en" : `/en${pathname}`;
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  const redirectedChunk = fixDoubleEncodedAppChunk(request);
  if (redirectedChunk) {
    return redirectedChunk;
  }

  if (url.searchParams.get("lang") === "en" && isMarketingPath(url.pathname)) {
    const redirectUrl = url.clone();
    redirectUrl.pathname = englishMarketingPath(url.pathname);
    redirectUrl.searchParams.delete("lang");
    return NextResponse.redirect(redirectUrl);
  }

  if (isPublicFacingPath(url.pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(PUBLIC_ANALYTICS_HEADER, "1");
    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/_next/static/chunks/app/:path*", "/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
