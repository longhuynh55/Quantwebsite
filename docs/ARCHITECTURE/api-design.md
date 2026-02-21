# API Design

## Overview
QuantVN uses Next.js App Router API routes for backend functionality.

## Endpoints

### Dashboard API

#### GET /api/dashboard/layouts
Get saved dashboard layouts.

**Response:**
```json
{
  "layouts": {
    "lg": [{ "i": "widget-1", "x": 0, "y": 0, "w": 6, "h": 4 }]
  },
  "widgets": [
    { "id": "widget-1", "type": "portfolio-value", "title": "Portfolio" }
  ]
}
```

#### POST /api/dashboard/layouts
Save dashboard layouts.

**Body:**
```json
{
  "layouts": { ... },
  "widgets": [ ... ]
}
```

### Strategy API

#### GET /api/strategies
List all saved strategies.

**Response:**
```json
{
  "strategies": [
    {
      "id": "strat-1",
      "name": "RSI Momentum",
      "nodes": [ ... ],
      "edges": [ ... ],
      "createdAt": "2026-02-20T10:00:00Z"
    }
  ]
}
```

#### POST /api/strategies
Create a new strategy.

**Body:**
```json
{
  "name": "My Strategy",
  "description": "Description",
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

#### POST /api/strategies/:id/backtest
Run backtest for a strategy.

**Response:**
```json
{
  "results": {
    "totalReturn": 45.2,
    "sharpeRatio": 1.85,
    "maxDrawdown": -12.5,
    "winRate": 62.3
  }
}
```

### Real-time API

#### WebSocket /api/ws
Real-time price updates.

**Message Types:**
```typescript
// Subscribe
{ "type": "subscribe", "topic": "prices:VNM" }

// Price Update
{ "type": "price", "symbol": "VNM", "price": 76.5, "change": 1.2 }

// Heartbeat
{ "type": "ping" }
{ "type": "pong" }
```

### AI Assistant API

#### POST /api/ai/generate-strategy
Generate strategy from natural language.

**Body:**
```json
{
  "prompt": "Tạo chiến lược RSI với điều kiện mua khi RSI < 30"
}
```

**Response:**
```json
{
  "strategy": {
    "nodes": [ ... ],
    "edges": [ ... ],
    "explanation": "Chiến lược này sử dụng RSI..."
  }
}
```

## Error Handling

All API errors follow this format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { ... }
  }
}
```

## Rate Limiting

- API: 100 requests/minute
- WebSocket: 10 subscriptions/second
- AI: 10 requests/minute

## Authentication

JWT-based authentication for protected endpoints:
```
Authorization: Bearer <token>
```
