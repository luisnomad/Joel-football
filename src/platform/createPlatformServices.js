import { Capacitor } from '@capacitor/core';
import { CapacitorPlatformServices } from './CapacitorPlatformServices.js';
import { WebPlatformServices } from './WebPlatformServices.js';

export const createPlatformServices = () => (
  Capacitor.isNativePlatform()
    ? new CapacitorPlatformServices()
    : new WebPlatformServices()
);
