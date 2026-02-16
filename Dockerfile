FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
ARG INSTALL_DUCKDB_BINDING=false
RUN npm ci --legacy-peer-deps \
  && if [ "$INSTALL_DUCKDB_BINDING" = "true" ]; then npm install duckdb --no-save --legacy-peer-deps; fi

FROM node:20-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY package.json package-lock.json ./
ARG INSTALL_DUCKDB_BINDING=false
RUN npm ci --omit=dev --legacy-peer-deps \
  && if [ "$INSTALL_DUCKDB_BINDING" = "true" ]; then npm install duckdb --no-save --legacy-peer-deps; fi

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-p", "3000"]
