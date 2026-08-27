const configuredBuildCpus = Number.parseInt(process.env.NEXT_BUILD_CPUS ?? "", 10);
const buildCpus =
  Number.isInteger(configuredBuildCpus) && configuredBuildCpus > 0
    ? configuredBuildCpus
    : undefined;

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
    : {})
};

export default nextConfig;
