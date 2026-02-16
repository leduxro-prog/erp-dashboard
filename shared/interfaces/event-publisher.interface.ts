export interface IEventPublisher {
  publish(eventName: string, data: unknown): Promise<void>;
}
