/**
 * WebSocket Types for Real-time Data Infrastructure
 */

// Connection status types
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// WebSocket message types
export type WebSocketMessageType =
  | 'subscribe'
  | 'unsubscribe'
  | 'ping'
  | 'pong'
  | 'price_update'
  | 'market_status'
  | 'error'
  | 'ack';

// Topic types for subscriptions
export type SubscriptionTopic =
  | `price:${string}` // e.g., "price:VNM"
  | `market:${string}` // e.g., "market:HOSE"
  | `depth:${string}` // e.g., "depth:VNM" for order book
  | `trade:${string}`; // e.g., "trade:VNM" for trade stream

// Base WebSocket message structure
export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  topic?: SubscriptionTopic;
  payload?: T;
  timestamp: number;
  requestId?: string;
}

// Price update payload
export interface PriceUpdatePayload {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

// Market status payload
export interface MarketStatusPayload {
  exchange: string;
  status: 'open' | 'closed' | 'pre_open' | 'intermission' | 'settlement';
  session?: string;
  nextOpen?: number;
  nextClose?: number;
  timestamp: number;
}

// Subscription request
export interface SubscriptionRequest {
  topic: SubscriptionTopic;
  action: 'subscribe' | 'unsubscribe';
}

// Subscription acknowledgment
export interface SubscriptionAck {
  topic: SubscriptionTopic;
  success: boolean;
  error?: string;
}

// Error payload
export interface ErrorPayload {
  code: string;
  message: string;
  topic?: SubscriptionTopic;
  recoverable: boolean;
}

// WebSocket configuration
export interface WebSocketConfig {
  url: string;
  reconnectAttempts: number;
  reconnectBaseDelay: number; // Base delay in ms for exponential backoff
  reconnectMaxDelay: number; // Max delay in ms
  heartbeatInterval: number; // Heartbeat interval in ms (default: 30000)
  connectionTimeout: number; // Connection timeout in ms
  debug: boolean;
}

// Subscription state
export interface SubscriptionState {
  topic: SubscriptionTopic;
  subscribedAt: number;
  lastMessageAt: number | null;
  messageCount: number;
  active: boolean;
}

// Connection statistics
export interface ConnectionStats {
  connectCount: number;
  disconnectCount: number;
  reconnectCount: number;
  messagesReceived: number;
  messagesSent: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  uptimeMs: number;
}

// Real-time price data stored in the store
export interface RealtimePrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  lastUpdate: number;
}

// Default WebSocket configuration
export const DEFAULT_WEBSOCKET_CONFIG: WebSocketConfig = {
  url: typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`
    : 'ws://localhost:3000/api/ws',
  reconnectAttempts: 10,
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  heartbeatInterval: 30000, // 30 seconds
  connectionTimeout: 10000,
  debug: process.env.NODE_ENV === 'development',
};

// WebSocket error codes
export const WS_ERROR_CODES = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  SUBSCRIPTION_FAILED: 'SUBSCRIPTION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  TOPIC_NOT_FOUND: 'TOPIC_NOT_FOUND',
} as const;

export type WsErrorCode = typeof WS_ERROR_CODES[keyof typeof WS_ERROR_CODES];
