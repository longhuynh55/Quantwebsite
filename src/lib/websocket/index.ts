/**
 * WebSocket Module Exports
 */

// Types
export type {
  ConnectionStatus,
  WebSocketMessageType,
  SubscriptionTopic,
  WebSocketMessage,
  PriceUpdatePayload,
  MarketStatusPayload,
  SubscriptionRequest,
  SubscriptionAck,
  ErrorPayload,
  WebSocketConfig,
  SubscriptionState,
  ConnectionStats,
  RealtimePrice,
} from './types';

export { DEFAULT_WEBSOCKET_CONFIG, WS_ERROR_CODES } from './types';
export type { WsErrorCode } from './types';

// WebSocket Manager
export { WebSocketManager, getWebSocketManager, resetWebSocketManager } from './WebSocketManager';

// Subscription Manager
export { SubscriptionManager, createSubscriptionManager } from './SubscriptionManager';
