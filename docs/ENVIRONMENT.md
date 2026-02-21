# Environment Variables Documentation

This document describes all environment variables used in the QuantVN application.

## Quick Start

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required values (marked as Required below)

3. Never commit `.env.local` or any files containing real secrets

## Required Variables

These variables must be set for the application to function properly.

### `NEXT_PUBLIC_APP_URL`

- **Required:** Yes
- **Default:** `http://localhost:3000`
- **Description:** The public URL of your application. Used for generating absolute URLs, CORS configuration, and OAuth callbacks.
- **Example:**
  - Development: `http://localhost:3000`
  - Production: `https://quantvn.com`
- **Note:** Must include protocol (http:// or https://)

### `DATABASE_URL`

- **Required:** Yes (for features requiring database)
- **Default:** None
- **Description:** PostgreSQL database connection string.
- **Format:** `postgresql://user:password@host:port/database`
- **Example:** `postgresql://postgres:password@localhost:5432/quantvn`

## Authentication

### `NEXTAUTH_SECRET`

- **Required:** Yes (if using authentication)
- **Default:** None
- **Description:** Secret key for NextAuth.js JWT encryption.
- **Generate:** `openssl rand -base64 32`

### `NEXTAUTH_URL`

- **Required:** Yes (if using authentication)
- **Default:** Same as `NEXT_PUBLIC_APP_URL`
- **Description:** Canonical URL of your site for NextAuth.js.

## AI & API Keys

### `OPENROUTER_API_KEY`

- **Required:** No
- **Description:** API key for OpenRouter AI services. Used for AI assistant features.
- **Get at:** https://openrouter.ai/keys

### `GLM_API_KEY`

- **Required:** No
- **Description:** API key for GLM AI services. Used for Vietnamese stock market AI assistant.
- **Get at:** https://z.ai/api

### `OPENAI_API_KEY`

- **Required:** No
- **Description:** OpenAI API key. Alternative AI provider.
- **Get at:** https://platform.openai.com/api-keys

## Monitoring & Error Tracking

### `NEXT_PUBLIC_ENABLE_MONITORING`

- **Required:** No
- **Default:** `false`
- **Description:** Enable performance monitoring in production. When enabled, metrics are collected and can be sent to external monitoring services.
- **Values:** `true` | `false`

### `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`

- **Required:** No (recommended for production)
- **Description:** Sentry DSN for error tracking and performance monitoring.
- **Get at:** https://sentry.io/settings/projects/
- **Note:** `NEXT_PUBLIC_SENTRY_DSN` is exposed to client, `SENTRY_DSN` is server-only

### `NEXT_PUBLIC_ERROR_ENDPOINT`

- **Required:** No
- **Description:** Custom endpoint for error reporting. Alternative to Sentry.
- **Example:** `https://api.example.com/errors`

## Analytics

### `NEXT_PUBLIC_GA_MEASUREMENT_ID`

- **Required:** No
- **Description:** Google Analytics 4 Measurement ID.
- **Format:** `G-XXXXXXXXXX`
- **Get at:** Google Analytics admin settings

### `NEXT_PUBLIC_VERCEL_ANALYTICS_ID`

- **Required:** No
- **Description:** Vercel Analytics ID. Auto-configured on Vercel deployments.

## Feature Flags

### `NEXT_PUBLIC_ENABLE_AI_ASSISTANT`

- **Required:** No
- **Default:** `false`
- **Description:** Enable the AI assistant feature in the UI.
- **Values:** `true` | `false`

### `NEXT_PUBLIC_ENABLE_EXPERIMENTAL`

- **Required:** No
- **Default:** `false`
- **Description:** Enable experimental features that may be unstable.
- **Values:** `true` | `false`

### `NEXT_PUBLIC_DEBUG`

- **Required:** No
- **Default:** `false`
- **Description:** Enable debug mode with additional logging and UI elements.
- **Warning:** Should only be enabled in development
- **Values:** `true` | `false`

## Rate Limiting & Caching

### `REDIS_URL`

- **Required:** No
- **Description:** Redis connection URL for rate limiting and caching.
- **Format:** `redis://user:password@host:port`
- **Example:** `redis://localhost:6379`

### `RATE_LIMIT_PER_MINUTE`

- **Required:** No
- **Default:** `60`
- **Description:** Maximum API requests per minute per IP.
- **Note:** Only effective if Redis is configured

## Stock Data APIs

### `VPS_API_KEY`

- **Required:** No
- **Description:** VPS Securities API key for Vietnamese stock data.

### `HOSE_API_KEY`

- **Required:** No
- **Description:** Ho Chi Minh Stock Exchange API key.

### `ALPHA_VANTAGE_API_KEY`

- **Required:** No
- **Description:** Alpha Vantage API key. Used as backup data source.
- **Get at:** https://www.alphavantage.co/support/#api-key

## Environment-Specific Configuration

### Development

```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_ENABLE_MONITORING=false
```

### Production

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_ENABLE_MONITORING=true
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Testing

```env
NODE_ENV=test
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://test:test@localhost:5432/quantvn_test
```

## Security Best Practices

1. **Never commit secrets:** Always use `.env.local` or secure secret management
2. **Rotate keys regularly:** Change API keys and secrets periodically
3. **Limit access:** Only expose variables to client when necessary (prefix with `NEXT_PUBLIC_`)
4. **Validate in CI:** Check for required variables in CI/CD pipeline
5. **Use secrets manager:** In production, use platform secret management (Vercel, AWS, etc.)

## Variable Prefixes

- `NEXT_PUBLIC_`: Exposed to both client and server
- No prefix: Server-side only (more secure)

## Troubleshooting

### Variables not loading

1. Ensure file is named `.env.local` (not `.env`)
2. Restart the development server
3. Check for syntax errors (no spaces around `=`)

### Client can't access variable

1. Ensure variable starts with `NEXT_PUBLIC_`
2. Rebuild the application

### Database connection fails

1. Verify `DATABASE_URL` format
2. Check database is running
3. Verify network connectivity
4. Check credentials

## Related Documentation

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
