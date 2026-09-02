FROM node:20-bookworm-slim AS build

ARG NEXT_BUILD_CPUS=1
ARG API_BASE_URL=http://api:8000
ARG NEXT_PUBLIC_API_BASE_URL=/api

ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_BUILD_CPUS=${NEXT_BUILD_CPUS} \
    API_BASE_URL=${API_BASE_URL} \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

WORKDIR /app/apps/web

COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

COPY apps/web/ ./
RUN npm run build

FROM node:20-bookworm-slim AS runtime

ARG HOST_UID=1000
ARG HOST_GID=1000

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PATH="/app/apps/web/node_modules/.bin:${PATH}"

WORKDIR /app/apps/web

COPY --from=build --chown=${HOST_UID}:${HOST_GID} /app/apps/web/package.json ./
COPY --from=build --chown=${HOST_UID}:${HOST_GID} /app/apps/web/package-lock.json ./
COPY --from=build --chown=${HOST_UID}:${HOST_GID} /app/apps/web/node_modules ./node_modules
COPY --from=build --chown=${HOST_UID}:${HOST_GID} /app/apps/web/public ./public
COPY --from=build --chown=${HOST_UID}:${HOST_GID} /app/apps/web/.next ./.next
COPY --from=build --chown=${HOST_UID}:${HOST_GID} /app/apps/web/next.config.mjs ./next.config.mjs
COPY --from=build --chown=${HOST_UID}:${HOST_GID} /app/apps/web/postcss.config.js ./postcss.config.js
COPY --from=build --chown=${HOST_UID}:${HOST_GID} /app/apps/web/tailwind.config.ts ./tailwind.config.ts
COPY --from=build --chown=${HOST_UID}:${HOST_GID} /app/apps/web/tsconfig.json ./tsconfig.json
COPY --from=build --chown=${HOST_UID}:${HOST_GID} /app/apps/web/next-env.d.ts ./next-env.d.ts

CMD ["./node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
