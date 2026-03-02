/**
 * WebSocket Manager - Connection management with auto-reconnect and heartbeat
 */

import type {
  WebSocketConfig,
  WebSocketMessage,
  ConnectionStatus,
  ConnectionStats,
} from './types';
import { DEFAULT_WEBSOCKET_CONFIG } from './types';

type MessageHandler = (message: WebSocketMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;
type ErrorHandler = (error: Error) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private stats: ConnectionStats = {
    connectCount: 0,
    disconnectCount: 0,
    reconnectCount: 0,
    messagesReceived: 0,
    messagesSent: 0,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    uptimeMs: 0,
  };
  private connectionStartTime: number | null = null;
  private intentionalDisconnect = false;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = { ...DEFAULT_WEBSOCKET_CONFIG, ...config };
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      this.log('Already connected or connecting');
      return;
    }

    this.intentionalDisconnect = false;
    this.setStatus('connecting');
    this.clearTimers();

    try {
      this.ws = new WebSocket(this.config.url);
      this.setupEventHandlers();
      this.startConnectionTimeout();
    } catch (error) {
      this.handleError(error as Error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearTimers();
    this.closeConnection(1000, 'Client disconnect');
    this.setStatus('disconnected');
  }

  /**
   * Send a message through the WebSocket
   */
  send<T>(message: WebSocketMessage<T>): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.log('WebSocket not open, queuing message');
      const queueLimit = Math.max(0, Math.trunc(this.config.maxQueueSize));
      if (queueLimit === 0) {
        this.log('Message queue disabled; dropping outbound message:', message.type);
        return false;
      }
      if (this.messageQueue.length >= queueLimit) {
        this.messageQueue.shift();
        this.log('Message queue full; dropped oldest outbound message');
      }
      this.messageQueue.push(message as WebSocketMessage);
      return false;
    }

    try {
      const payload = JSON.stringify(message);
      this.ws.send(payload);
      this.stats.messagesSent++;
      this.log('Sent message:', message.type);
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * Subscribe to message events
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Subscribe to status change events
   */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /**
   * Subscribe to error events
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    if (this.connectionStartTime && this.status === 'connected') {
      this.stats.uptimeMs = Date.now() - this.connectionStartTime;
    }
    return { ...this.stats };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WebSocketConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.log('Connected');
      this.clearConnectionTimeout();
      this.connectionStartTime = Date.now();
      this.stats.connectCount++;
      this.stats.lastConnectedAt = Date.now();
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      this.startHeartbeat();
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.stats.messagesReceived++;
        this.handleMessage(message);
      } catch (error) {
        this.handleError(new Error(`Failed to parse message: ${error}`));
      }
    };

    this.ws.onclose = (event) => {
      this.log(`Connection closed: ${event.code} - ${event.reason}`);
      this.clearTimers();
      this.stats.disconnectCount++;
      this.stats.lastDisconnectedAt = Date.now();

      if (this.connectionStartTime) {
        this.stats.uptimeMs += Date.now() - this.connectionStartTime;
        this.connectionStartTime = null;
      }

      if (!this.intentionalDisconnect) {
        this.setStatus('reconnecting');
        this.scheduleReconnect();
      } else {
        this.setStatus('disconnected');
      }
    };

    this.ws.onerror = () => {
      this.handleError(new Error('WebSocket error'));
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    // Handle pong responses
    if (message.type === 'pong') {
      this.log('Received pong');
      return;
    }

    // Notify all message handlers
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        this.handleError(error as Error);
      }
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          timestamp: Date.now(),
        });
        this.log('Sent ping');
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startConnectionTimeout(): void {
    this.connectionTimer = setTimeout(() => {
      if (this.status === 'connecting') {
        this.handleError(new Error('Connection timeout'));
        this.closeConnection(1000, 'Connection timeout');
        this.scheduleReconnect();
      }
    }, this.config.connectionTimeout);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalDisconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      this.log('Max reconnect attempts reached');
      this.setStatus('disconnected');
      return;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts) +
        Math.random() * 1000,
      this.config.reconnectMaxDelay
    );

    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.stats.reconnectCount++;
      this.connect();
    }, delay);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private closeConnection(code: number, reason: string): void {
    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    this.clearConnectionTimeout();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.log(`Status changed to: ${status}`);
      this.statusHandlers.forEach((handler) => {
        try {
          handler(status);
        } catch (error) {
          this.handleError(error as Error);
        }
      });
    }
  }

  private handleError(error: Error): void {
    this.log('Error:', error.message);
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[WebSocketManager]', ...args);
    }
  }
}

// Singleton instance for global use
let wsManagerInstance: WebSocketManager | null = null;

export function getWebSocketManager(config?: Partial<WebSocketConfig>): WebSocketManager {
  if (!wsManagerInstance) {
    wsManagerInstance = new WebSocketManager(config);
  } else if (config) {
    wsManagerInstance.updateConfig(config);
  }
  return wsManagerInstance;
}

export function resetWebSocketManager(): void {
  if (wsManagerInstance) {
    wsManagerInstance.disconnect();
    wsManagerInstance = null;
  }
}
