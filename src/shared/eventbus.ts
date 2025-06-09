import { EventEmitter } from 'events';
import winston from 'winston';

// Create logger for event bus
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [EVENTBUS] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'eventbus.log' })
  ]
});

export interface EventData {
  event_id: string;
  timestamp: string;
  service: string;
  [key: string]: any;
}

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private serviceName: string;

  private constructor(serviceName: string = 'unknown') {
    super();
    this.serviceName = serviceName;
    this.setMaxListeners(100); // Increase max listeners for distributed system
  }

  public static getInstance(serviceName?: string): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus(serviceName);
    }
    return EventBus.instance;
  }

  async publish(event: string, data: any): Promise<void> {
    const eventData: EventData = {
      ...data,
      event_id: `${event}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      service: this.serviceName
    };

    try {
      this.emit(event, eventData);
      logger.info(`📤 Published: ${event} from ${this.serviceName}`);
    } catch (error) {
      logger.error(`❌ Failed to publish ${event}:`, error);
      throw error;
    }
  }

  subscribe(event: string, handler: (data: EventData) => void): void {
    this.on(event, (data: EventData) => {
      try {
        logger.info(`📥 Received: ${event} in ${this.serviceName}`);
        handler(data);
      } catch (error) {
        logger.error(`❌ Event handler error for ${event}:`, error);
      }
    });
    
    logger.info(`📥 Subscribed to: ${event} in ${this.serviceName}`);
  }

  unsubscribe(event: string, handler?: Function): void {
    if (handler) {
      this.off(event, handler);
    } else {
      this.removeAllListeners(event);
    }
    logger.info(`📤 Unsubscribed from: ${event} in ${this.serviceName}`);
  }

  // Get all active events
  getActiveEvents(): string[] {
    return this.eventNames() as string[];
  }

  // Get listener count for an event
  getListenerCount(event: string): number {
    return this.listenerCount(event);
  }
}

// Export singleton instance
export const eventBus = EventBus.getInstance();
