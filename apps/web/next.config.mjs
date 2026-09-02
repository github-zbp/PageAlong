const configuredBuildCpus = Number.parseInt(process.env.NEXT_BUILD_CPUS ?? "", 10);
const buildCpus =
  Number.isInteger(configuredBuildCpus) && configuredBuildCpus > 0
    ? configuredBuildCpus
    : undefined;
const defaultServerApiBaseUrl = "http://127.0.0.1:8000";
const configuredServerApiBaseUrl = process.env.API_BASE_URL ?? defaultServerApiBaseUrl;
const configuredPublicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function publicApiBaseIsRelative() {
  return configuredPublicApiBaseUrl.startsWith("/");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  ...(buildCpus
    ? {
        experimental: {
          cpus: buildCpus
        }
      }
    : {}),
  async rewrites() {
    if (!publicApiBaseIsRelative()) {
      return [];
    }

    return [
      {
        source: `${trimTrailingSlash(configuredPublicApiBaseUrl)}/:path*`,
        destination: `${trimTrailingSlash(configuredServerApiBaseUrl)}/:path*`
      }
    ];
  }
};

export default nextConfig;
