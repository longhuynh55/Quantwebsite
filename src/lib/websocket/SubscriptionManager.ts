/**
 * Subscription Manager - Topic-based subscription management
 */

import type {
  SubscriptionTopic,
  SubscriptionState,
  WebSocketMessage,
  SubscriptionAck,
} from './types';
import { WebSocketManager } from './WebSocketManager';

type SubscriptionCallback = (payload: unknown) => void;
type UnsubscribeCallback = () => void;

export class SubscriptionManager {
  private subscriptions: Map<SubscriptionTopic, SubscriptionState> = new Map();
  private callbacks: Map<SubscriptionTopic, Set<SubscriptionCallback>> = new Map();
  private wsManager: WebSocketManager;
  private pendingSubscriptions: Set<SubscriptionTopic> = new Set();
  private resubscribeOnConnect: boolean = true;

  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
    this.setupMessageHandler();
    this.setupStatusHandler();
  }

  /**
   * Subscribe to a topic
   */
  subscribe(topic: SubscriptionTopic, callback: SubscriptionCallback): UnsubscribeCallback {
    // Add callback
    if (!this.callbacks.has(topic)) {
      this.callbacks.set(topic, new Set());
    }
    this.callbacks.get(topic)!.add(callback);

    // Check if we need to subscribe on the WebSocket level
    const existingSubscription = this.subscriptions.get(topic);

    if (existingSubscription?.active) {
      // Already subscribed, just return unsubscribe function
      this.log(`Already subscribed to ${topic}`);
    } else if (this.pendingSubscriptions.has(topic)) {
      // Subscription pending
      this.log(`Subscription pending for ${topic}`);
    } else {
      // New subscription needed
      this.sendSubscription(topic, 'subscribe');
    }

    // Return unsubscribe function
    return () => this.unsubscribe(topic, callback);
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: SubscriptionTopic, callback?: SubscriptionCallback): void {
    // Remove callback
    if (callback) {
      const callbacks = this.callbacks.get(topic);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.callbacks.delete(topic);
        }
      }
    } else {
      // Remove all callbacks for this topic
      this.callbacks.delete(topic);
    }

    // Check if we should unsubscribe from WebSocket
    const callbacks = this.callbacks.get(topic);
    if (!callbacks || callbacks.size === 0) {
      this.sendSubscription(topic, 'unsubscribe');
    }
  }

  /**
   * Unsubscribe from all topics
   */
  unsubscribeAll(): void {
    this.subscriptions.forEach((_, topic) => {
      this.sendSubscription(topic, 'unsubscribe');
    });
    this.callbacks.clear();
    this.subscriptions.clear();
    this.pendingSubscriptions.clear();
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): SubscriptionTopic[] {
    return Array.from(this.subscriptions.entries())
      .filter(([, state]) => state.active)
      .map(([topic]) => topic);
  }

  /**
   * Get subscription state
   */
  getSubscriptionState(topic: SubscriptionTopic): SubscriptionState | undefined {
    return this.subscriptions.get(topic);
  }

  /**
   * Check if subscribed to a topic
   */
  isSubscribed(topic: SubscriptionTopic): boolean {
    return this.subscriptions.get(topic)?.active ?? false;
  }

  /**
   * Set whether to resubscribe on reconnect
   */
  setResubscribeOnConnect(value: boolean): void {
    this.resubscribeOnConnect = value;
  }

  /**
   * Resubscribe to all active topics (useful after reconnect)
   */
  resubscribeAll(): void {
    this.subscriptions.forEach((state, topic) => {
      if (state.active || this.callbacks.has(topic)) {
        this.sendSubscription(topic, 'subscribe');
      }
    });
  }

  private setupMessageHandler(): void {
    this.wsManager.onMessage((message) => {
      this.handleMessage(message);
    });
  }

  private setupStatusHandler(): void {
    this.wsManager.onStatusChange((status) => {
      if (status === 'connected' && this.resubscribeOnConnect) {
        this.log('Reconnected, resubscribing to all topics');
        this.resubscribeAll();
      }
    });
  }

  private handleMessage(message: WebSocketMessage): void {
    const { type, topic, payload } = message;

    // Handle subscription acknowledgment
    if (type === 'ack' && topic) {
      this.handleAcknowledgment(topic, payload as SubscriptionAck);
      return;
    }

    // Handle data messages
    if (topic && (type === 'price_update' || type === 'market_status')) {
      this.notifyCallbacks(topic, payload);
    }
  }

  private handleAcknowledgment(topic: SubscriptionTopic, ack: SubscriptionAck): void {
    this.pendingSubscriptions.delete(topic);

    if (ack.success) {
      const existing = this.subscriptions.get(topic);
      this.subscriptions.set(topic, {
        topic,
        subscribedAt: existing?.subscribedAt ?? Date.now(),
        lastMessageAt: Date.now(),
        messageCount: existing?.messageCount ?? 0,
        active: true,
      });
      this.log(`Subscribed to ${topic}`);
    } else {
      this.subscriptions.set(topic, {
        topic,
        subscribedAt: Date.now(),
        lastMessageAt: null,
        messageCount: 0,
        active: false,
      });
      this.log(`Failed to subscribe to ${topic}: ${ack.error}`);
    }
  }

  private notifyCallbacks(topic: SubscriptionTopic, payload: unknown): void {
    // Update subscription state
    const state = this.subscriptions.get(topic);
    if (state) {
      state.lastMessageAt = Date.now();
      state.messageCount++;
    }

    // Notify all callbacks for this topic
    const callbacks = this.callbacks.get(topic);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in subscription callback for ${topic}:`, error);
        }
      });
    }
  }

  private sendSubscription(topic: SubscriptionTopic, action: 'subscribe' | 'unsubscribe'): void {
    const isConnected = this.wsManager.isConnected();

    if (!isConnected) {
      this.log(`WebSocket not connected, ${action} for ${topic} will be sent on connect`);
      if (action === 'subscribe') {
        // Mark as pending so we can subscribe when connected
        this.pendingSubscriptions.add(topic);
      }
      return;
    }

    if (action === 'subscribe') {
      this.pendingSubscriptions.add(topic);
    }

    this.wsManager.send({
      type: action === 'subscribe' ? 'subscribe' : 'unsubscribe',
      topic,
      payload: { action },
      timestamp: Date.now(),
    });

    this.log(`Sent ${action} for ${topic}`);
  }

  private log(...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[SubscriptionManager]', ...args);
    }
  }
}

// Factory function to create subscription manager
export function createSubscriptionManager(wsManager: WebSocketManager): SubscriptionManager {
  return new SubscriptionManager(wsManager);
}
