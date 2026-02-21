# WebSocket Real-time Data Infrastructure Specification

## Overview (Tong quan)

Real-time data infrastructure for Vietnamese stock market (HOSE) using WebSocket technology. Provides live price updates, market depth, and trade data with low latency and high reliability.

### Key Features (Tinh nang chinh)

- **Real-time Price Updates** - Cap nhat gia theo thoi gian thuc
- **Market Depth (Order Book)** - So lenh mua/ban theo gia
- **Trade Stream** - Luong du lieu giao dich truc tiep
- **Auto-reconnection** - Tu dong ket noi lai khi mat ket noi
- **Heartbeat Monitoring** - Giam sat trang thai ket noi
- **Subscription Management** - Quan ly dang ky nhan du lieu

---

## Architecture Overview

```
+------------------------------------------------------------------+
|                        CLIENT APPLICATION                         |
|  +------------------------------------------------------------+  |
|  |                    WebSocket Manager                        |  |
|  |  +------------------+  +------------------+  +-----------+ |  |
|  |  | Connection Pool  |  | Message Handler  |  |  Retry    | |  |
|  |  |                  |  |                  |  |  Logic    | |  |
|  |  +------------------+  +------------------+  +-----------+ |  |
|  +--------------------------+-----------------------------------+  |
+-----------------------------|-------------------------------------+
                              | WebSocket Connection
                              v
+------------------------------------------------------------------+
|                     WEBSOCKET SERVER                              |
|  +------------------------------------------------------------+  |
|  |                    Connection Handler                       |  |
|  |  +-------------+  +-------------+  +--------+  +---------+  |  |
|  |  |   Auth      |  | Subscription|  | Rate   |  | Message |  |  |
|  |  |   Handler   |  |   Manager   |  | Limiter|  | Router  |  |  |
|  |  +-------------+  +-------------+  +--------+  +---------+  |  |
|  +--------------------------+-----------------------------------+  |
|                             |                                     |
|  +--------------------------v-----------------------------------+  |
|  |                     Data Providers                          |  |
|  |  +-------------+  +-------------+  +--------+  +-----------+ |  |
|  |  |  HOSE Feed  |  |  HNX Feed   |  | Quote  |  | Trade     | |  |
|  |  |  (Primary)  |  |  (Secondary)|  | Engine |  | Processor | |  |
|  |  +-------------+  +-------------+  +--------+  +-----------+ |  |
|  +--------------------------+-----------------------------------+  |
+------------------------------------------------------------------+
```

---

## Component Structure

```
src/lib/websocket/
├── WebSocketManager.ts        # Main WebSocket connection manager
├── ConnectionPool.ts          # Multiple connection management
├── MessageHandler.ts          # Message parsing and routing
├── SubscriptionManager.ts     # Symbol subscription management
├── HeartbeatMonitor.ts        # Connection health monitoring
├── ReconnectionStrategy.ts    # Auto-reconnection logic
├── types.ts                   # TypeScript type definitions
└── index.ts                   # Barrel export

src/lib/stores/
├── realtimeStore.ts           # Zustand store for real-time data
├── connectionStore.ts         # Connection state management
└── subscriptionStore.ts       # Subscription state management

src/hooks/
├── useRealtimePrice.ts        # Hook for real-time price data
├── useMarketDepth.ts          # Hook for order book data
├── useTradeStream.ts          # Hook for trade stream data
├── useConnectionStatus.ts     # Hook for connection status
└── useSubscription.ts         # Hook for subscription management
```

---

## Technical Specifications

### WebSocketManager

Main class for managing WebSocket connections.

```typescript
interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  debug: boolean;
}

const DEFAULT_CONFIG: WebSocketConfig = {
  url: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.quantvn.vn/ws',
  reconnect: true,
  reconnectInterval: 1000,      // Start with 1 second
  maxReconnectAttempts: 10,     // Max 10 attempts
  heartbeatInterval: 30000,     // 30 seconds
  connectionTimeout: 10000,     // 10 seconds
  debug: process.env.NODE_ENV === 'development'
};

class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private listeners: Map<string, Set<MessageHandler>> = new Map();

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Connection management
  connect(): Promise<void>;
  disconnect(): void;
  reconnect(): void;

  // Subscription management
  subscribe(channel: string, symbols: string[]): void;
  unsubscribe(channel: string, symbols: string[]): void;

  // Message handling
  send(message: WebSocketMessage): void;
  on(event: string, handler: MessageHandler): () => void;
  off(event: string, handler: MessageHandler): void;

  // Status
  get isConnected(): boolean;
  get connectionState(): ConnectionState;
}
```

### Message Types

```typescript
// src/lib/websocket/types.ts

// Connection messages
interface ConnectionMessage {
  type: 'connected' | 'disconnected' | 'error' | 'pong';
  timestamp: string;
  serverTime?: string;
}

// Subscription messages
interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe' | 'subscribed' | 'unsubscribed';
  channel: string;
  symbols: string[];
  timestamp: string;
}

// Market data messages
interface PriceUpdateMessage {
  type: 'price_update';
  data: RealtimePrice;
  timestamp: string;
}

interface MarketDepthMessage {
  type: 'market_depth';
  data: MarketDepth;
  timestamp: string;
}

interface TradeMessage {
  type: 'trade';
  data: Trade;
  timestamp: string;
}

interface IndexUpdateMessage {
  type: 'index_update';
  data: IndexData;
  timestamp: string;
}

// Combined message type
type WebSocketMessage =
  | ConnectionMessage
  | SubscriptionMessage
  | PriceUpdateMessage
  | MarketDepthMessage
  | TradeMessage
  | IndexUpdateMessage;
```

### Data Structures

```typescript
// Real-time price data
interface RealtimePrice {
  symbol: string;
  exchange: 'HOSE' | 'HNX' | 'UPCOM';

  // Price data
  open: number;
  high: number;
  low: number;
  close: number;
  lastPrice: number;
  previousClose: number;

  // Change data
  change: number;
  changePercent: number;

  // Volume data
  volume: number;
  turnover: number;         // Total trading value
  avgVolume: number;        // Average volume

  // Trading data
  bidPrice: number;
  bidVolume: number;
  askPrice: number;
  askVolume: number;

  // Market data
  marketCap?: number;
  pe?: number;
  pb?: number;

  // Metadata
  tradingDate: string;
  updateTime: string;
  tradingStatus: 'normal' | 'halted' | 'suspended';
}

// Market depth (Order book)
interface MarketDepth {
  symbol: string;
  exchange: 'HOSE' | 'HNX' | 'UPCOM';
  updateTime: string;

  bids: OrderBookLevel[];   // Buy orders (descending price)
  asks: OrderBookLevel[];   // Sell orders (ascending price)
}

interface OrderBookLevel {
  price: number;
  volume: number;
  orderCount: number;
  change: number;           // Volume change from previous update
}

// Trade data
interface Trade {
  id: string;
  symbol: string;
  exchange: 'HOSE' | 'HNX' | 'UPCOM';

  price: number;
  volume: number;
  value: number;

  side: 'buy' | 'sell' | 'unknown';
  tradeTime: string;

  // For large trades
  isBlockTrade: boolean;
  isOddLot: boolean;
}

// Index data
interface IndexData {
  code: string;             // VNINDEX, VN30, HNX, etc.
  name: string;
  nameEn: string;

  value: number;
  change: number;
  changePercent: number;

  volume: number;
  turnover: number;

  // Market statistics
  advancers: number;        // Stocks increased
  decliners: number;        // Stocks decreased
  unchanged: number;        // Unchanged stocks
  ceiling: number;          // Hit ceiling price
  floor: number;            // Hit floor price

  updateTime: string;
}
```

---

## State Management (Quan ly trang thai)

### Zustand Store

```typescript
// src/lib/stores/realtimeStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface RealtimeState {
  // Price data
  prices: Record<string, RealtimePrice>;

  // Market depth
  depths: Record<string, MarketDepth>;

  // Trade stream
  trades: Record<string, Trade[]>;
  maxTradesPerSymbol: number;

  // Index data
  indices: Record<string, IndexData>;

  // Connection status
  connectionState: ConnectionState;
  lastHeartbeat: string | null;

  // Subscriptions
  subscriptions: {
    prices: Set<string>;
    depths: Set<string>;
    trades: Set<string>;
    indices: Set<string>;
  };

  // Actions
  updatePrice: (symbol: string, data: Partial<RealtimePrice>) => void;
  updateDepth: (symbol: string, data: MarketDepth) => void;
  addTrade: (symbol: string, trade: Trade) => void;
  updateIndex: (code: string, data: IndexData) => void;
  setConnectionState: (state: ConnectionState) => void;
  setLastHeartbeat: (time: string) => void;

  // Subscription actions
  subscribeToPrice: (symbol: string) => void;
  unsubscribeFromPrice: (symbol: string) => void;
  // ... more subscription actions

  // Reset
  reset: () => void;
}

type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';
```

---

## React Hooks

### useRealtimePrice

Hook for subscribing to real-time price updates.

```typescript
interface UseRealtimePriceOptions {
  enabled?: boolean;
  onUpdate?: (price: RealtimePrice) => void;
}

function useRealtimePrice(
  symbol: string | string[],
  options: UseRealtimePriceOptions = {}
): {
  data: RealtimePrice | Record<string, RealtimePrice> | null;
  isConnected: boolean;
  error: Error | null;
} {
  // Implementation
}

// Usage
const { data, isConnected } = useRealtimePrice('VIC');
```

### useMarketDepth

Hook for subscribing to order book updates.

```typescript
function useMarketDepth(
  symbol: string,
  options: { levels?: number; enabled?: boolean } = {}
): {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
  isConnected: boolean;
} {
  // Implementation
}

// Usage
const { bids, asks, spread } = useMarketDepth('VIC');
```

### useTradeStream

Hook for subscribing to trade stream.

```typescript
function useTradeStream(
  symbol: string,
  options: { limit?: number; enabled?: boolean } = {}
): {
  trades: Trade[];
  latestTrade: Trade | null;
  totalVolume: number;
  totalValue: number;
  isConnected: boolean;
} {
  // Implementation
}

// Usage
const { trades, latestTrade } = useTradeStream('VIC');
```

### useConnectionStatus

Hook for monitoring connection status.

```typescript
function useConnectionStatus(): {
  state: ConnectionState;
  isConnected: boolean;
  isReconnecting: boolean;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
} {
  // Implementation
}
```

---

## Reconnection Strategy

### Exponential Backoff

```typescript
class ReconnectionStrategy {
  private attempts: number = 0;
  private maxAttempts: number;
  private baseInterval: number;
  private maxInterval: number;
  private jitter: boolean;

  constructor(config: {
    maxAttempts: number;
    baseInterval: number;
    maxInterval: number;
    jitter?: boolean;
  }) {
    this.maxAttempts = config.maxAttempts;
    this.baseInterval = config.baseInterval;
    this.maxInterval = config.maxInterval;
    this.jitter = config.jitter ?? true;
  }

  getNextDelay(): number | null {
    if (this.attempts >= this.maxAttempts) {
      return null;  // No more retries
    }

    // Exponential backoff: base * 2^attempts
    let delay = this.baseInterval * Math.pow(2, this.attempts);

    // Cap at max interval
    delay = Math.min(delay, this.maxInterval);

    // Add jitter to prevent thundering herd
    if (this.jitter) {
      delay = delay * (0.5 + Math.random());
    }

    this.attempts++;
    return Math.floor(delay);
  }

  reset(): void {
    this.attempts = 0;
  }
}

// Usage
const reconnectionStrategy = new ReconnectionStrategy({
  maxAttempts: 10,
  baseInterval: 1000,    // 1 second
  maxInterval: 60000,    // 1 minute
  jitter: true
});
```

---

## Usage Examples (Vi du su dung)

### Basic Price Subscription

```typescript
import { useRealtimePrice } from '@/hooks/useRealtimePrice';

function StockPrice({ symbol }: { symbol: string }) {
  const { data, isConnected } = useRealtimePrice(symbol);

  if (!data) {
    return <Skeleton className="h-8 w-24" />;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold">
        {data.lastPrice.toLocaleString()}
      </span>
      <span className={cn(
        'text-sm',
        data.change >= 0 ? 'text-green-500' : 'text-red-500'
      )}>
        {data.change >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
      </span>
      {!isConnected && (
        <Badge variant="warning">Disconnected</Badge>
      )}
    </div>
  );
}
```

### Order Book Component

```typescript
import { useMarketDepth } from '@/hooks/useMarketDepth';

function OrderBook({ symbol }: { symbol: string }) {
  const { bids, asks, spread, spreadPercent } = useMarketDepth(symbol);

  return (
    <Card>
      <CardHeader>
        <CardTitle>So lenh (Order Book)</CardTitle>
        <div className="text-sm text-muted-foreground">
          Spread: {spread.toLocaleString()} ({spreadPercent.toFixed(2)}%)
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Bids (Buy orders) */}
          <div>
            <div className="text-sm font-medium text-green-500 mb-2">MUA</div>
            {bids.map((level, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{level.price.toLocaleString()}</span>
                <span>{level.volume.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Asks (Sell orders) */}
          <div>
            <div className="text-sm font-medium text-red-500 mb-2">BAN</div>
            {asks.map((level, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{level.price.toLocaleString()}</span>
                <span>{level.volume.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Error Handling

### Error Types

```typescript
type WSErrorCode =
  | 'CONNECTION_FAILED'
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'INVALID_MESSAGE'
  | 'SUBSCRIPTION_LIMIT'
  | 'SYMBOL_NOT_FOUND'
  | 'INTERNAL_ERROR';

interface WSError {
  code: WSErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
```

### Error Handler

```typescript
function handleWebSocketError(error: WSError): void {
  switch (error.code) {
    case 'CONNECTION_FAILED':
      console.error('Connection failed, attempting reconnect...');
      wsManager.reconnect();
      break;

    case 'AUTH_FAILED':
      console.error('Authentication failed');
      // Redirect to login or show error
      break;

    case 'RATE_LIMITED':
      console.warn('Rate limited, waiting...');
      // Implement backoff
      break;

    default:
      console.error('WebSocket error:', error);
  }
}
```

---

## Mock Mode (Che do mo phong)

For development without a real WebSocket server:

```typescript
const manager = new WebSocketManager({
  mock: true,
  mockData: {
    priceUpdateInterval: 1000,
    tradeInterval: 500
  }
});

// Simulates price updates and trades for testing
```

---

## API Integration

### WebSocket Endpoints

```
Production: wss://api.quantvn.vn/ws
Staging: wss://staging-api.quantvn.vn/ws
Development: ws://localhost:8080/ws
```

### Channel Subscription

```typescript
// Subscribe to channels
ws.send({
  type: 'subscribe',
  channels: [
    { name: 'price', symbols: ['VIC', 'VNM', 'FPT'] },
    { name: 'depth', symbols: ['VIC'] },
    { name: 'trades', symbols: ['VIC', 'VNM'] },
    { name: 'index', codes: ['VNINDEX', 'VN30'] }
  ]
});
```

---

## Performance Considerations

1. **Message Batching** - Batch multiple updates into single messages
2. **Delta Updates** - Send only changed data, not full snapshots
3. **Compression** - Use WebSocket compression extension
4. **Connection Pooling** - Multiple connections for different data types
5. **Lazy Subscriptions** - Only subscribe when data is needed
6. **Cleanup** - Unsubscribe when components unmount

---

## Dependencies

```json
{
  "dependencies": {
    "zustand": "^4.5.7",
    "eventemitter3": "^5.0.1"
  }
}
```

---

*Document Version: 1.0*
*Last Updated: February 2026*
*Author: QuantVN Team*
