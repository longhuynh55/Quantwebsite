FROM node:20-bookworm-slim AS deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
ARG INSTALL_DUCKDB_BINDING=false
RUN pnpm install --frozen-lockfile \
  && if [ "$INSTALL_DUCKDB_BINDING" = "true" ]; then pnpm add duckdb; fi

FROM node:20-bookworm-slim AS builder

WORKDIR /app
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1024
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
ARG INSTALL_DUCKDB_BINDING=false
RUN pnpm install --prod --frozen-lockfile \
  && if [ "$INSTALL_DUCKDB_BINDING" = "true" ]; then pnpm add --prod duckdb; fi

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["pnpm", "run", "start"]
