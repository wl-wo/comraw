/**
 * Global type augmentations for window object
 * These are set up by the compositor and available to the UI
 */

import type { WoClient, Compositor, SurfaceBufferData, NotificationData } from '@wl-wo/wo-types';

type SurfaceSabData = {
  name: string;
  sab: SharedArrayBuffer;
  width: number;
  height: number;
  stride: number;
};

type SurfaceUpdateData = {
  name: string;
  width: number;
  height: number;
  stride: number;
  generation: number;
  damageRects?: Array<{x: number; y: number; width: number; height: number}>;
};

declare global {
  interface Window {
    /**
     * The compositor API for controlling windows and system
     */
    compositor: Compositor & {
      onSurfaceSab?: (callback: (data: SurfaceSabData) => void) => (() => void);
      onSurfaceUpdate?: (callback: (data: SurfaceUpdateData) => void) => (() => void);
    };

    /**
     * Wayland client for receiving window updates from compositor
     */
    woClient?: WoClient;
  }
}

export {};
