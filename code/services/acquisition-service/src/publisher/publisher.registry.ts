import type { PlatformPublisher } from './publisher.types';
import { XhsPublisher, type XhsPublisherOptions } from './xhs.publisher';

export interface PublisherRegistryOptions {
  xhs?: XhsPublisherOptions;
}

export function createPublisherRegistry(
  options: PublisherRegistryOptions = {}
): Map<string, PlatformPublisher> {
  const xhs = new XhsPublisher(options.xhs);
  return new Map<string, PlatformPublisher>([[xhs.platform, xhs]]);
}

export function resolvePublisher(
  registry: Map<string, PlatformPublisher>,
  platform: string
): PlatformPublisher {
  const publisher = registry.get(platform);
  if (!publisher) {
    throw new Error(`No publisher registered for platform: ${platform}`);
  }
  return publisher;
}
