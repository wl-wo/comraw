/**
 * Global type augmentations for window object
 * These are set up by the compositor and available to the UI
 */

import type { WoClient, Compositor, SurfaceBufferData, NotificationData } from '@wl-wo/wo-types';

declare global {
  interface Window {
    /**
     * The compositor API for controlling windows and system
     */
    compositor: Compositor;

    /**
     * Wayland client for receiving window updates from compositor
     */
    woClient?: WoClient;
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    'iconify-icon': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        icon?: string;
        width?: string | number;
        height?: string | number;
        inline?: boolean;
        rotate?: string | number;
        flip?: string;
      },
      HTMLElement
    >;
  }
}

export {};
