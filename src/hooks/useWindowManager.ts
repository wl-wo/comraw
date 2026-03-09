import { useEffect, useState, useCallback, useRef } from 'react';
import type { SurfaceBufferData, WoWindow } from '@wl-wo/wo-types';
import { updatePixelBuffer } from '../stores/pixelBufferStore';

/**
 * Extended window type with compositor metadata.
 * Pixel buffers are stored in the pixelBufferStore (outside React state)
 * to avoid re-render cascades on every frame.
 */
export type CompositorWindow = WoWindow;

export function useWindowManager() {
  const [windows, setWindows] = useState<CompositorWindow[]>([]);
  const [focusedWindow, setFocusedWindow] = useState<string | null>(null);
  const seenWindowsRef = useRef(new Set<string>());
  const pendingSurfaceBuffersRef = useRef(new Map<string, SurfaceBufferData>());
  const surfaceFlushRafRef = useRef<number | null>(null);

  // Subscribe to window list updates (WOWM metadata).
  useEffect(() => {
    const pendingSurfaceBuffers = pendingSurfaceBuffersRef.current;

    const unsubscribeWindows = window.woClient?.onWindows((newWindows: WoWindow[]) => {
      const dedupedWindows = Array.from(
        new Map(newWindows.map((w) => [w.name, w])).values(),
      );

      const compositorFocused = dedupedWindows.find((w) => w.focused === true)?.name ?? null;

      // Auto-focus newly appeared Wayland windows
      const newWaylandWin = dedupedWindows.find(
        (w: WoWindow) => w.source === 'wayland' && !seenWindowsRef.current.has(w.name),
      );
      for (const w of dedupedWindows) seenWindowsRef.current.add(w.name);

      if (newWaylandWin) {
        window.compositor?.action('focus', { window: newWaylandWin.name });
        setFocusedWindow(newWaylandWin.name);
      }

      if (compositorFocused) {
        setFocusedWindow(compositorFocused);
      } else {
        setFocusedWindow((prev) =>
          prev && dedupedWindows.some((w) => w.name === prev) ? prev : null,
        );
      }

      setWindows(dedupedWindows.map((w: WoWindow) => ({ ...w })));
    });

    const flushSurfaceBuffers = () => {
      surfaceFlushRafRef.current = null;
      for (const data of pendingSurfaceBuffersRef.current.values()) {
        const { name, width: pw, height: ph, stride, pixels } = data;
        const buffer = pixels instanceof Uint8Array ? pixels : new Uint8Array(pixels);
        updatePixelBuffer(name, buffer, pw, ph, stride);
      }
      pendingSurfaceBuffersRef.current.clear();
    };

    const unsubscribePixels = window.compositor.onSurfaceBuffer((data: SurfaceBufferData) => {
      pendingSurfaceBuffersRef.current.set(data.name, data);
      if (surfaceFlushRafRef.current === null) {
        surfaceFlushRafRef.current = requestAnimationFrame(flushSurfaceBuffers);
      }
    });

    return () => {
      unsubscribeWindows?.();
      unsubscribePixels?.();
      if (surfaceFlushRafRef.current !== null) {
        cancelAnimationFrame(surfaceFlushRafRef.current);
      }
      pendingSurfaceBuffers.clear();
    };
  }, []);

  // Focus change events from compositor
  useEffect(() => {
    const unsub = window.compositor?.onFocusChange((windowName: string, focused: boolean) => {
      if (focused) setFocusedWindow(windowName);
      else {
        setFocusedWindow((prev) => (prev === windowName ? null : prev));
      }
    });
    return () => unsub?.();
  }, []);

  const focusWindow = useCallback((name: string) => {
    window.compositor?.action('focus', { window: name });
    setFocusedWindow(name);
  }, []);

  const minimizeWindow = useCallback((name: string) => {
    window.compositor?.action('minimize', { window: name });
  }, []);

  const closeWindow = useCallback((name: string) => {
    window.compositor?.action('close', { window: name });
    setWindows((prev) => prev.filter((w) => w.name !== name));
  }, []);

  const maximizeWindow = useCallback((name: string) => {
    window.compositor?.action('maximize', { window: name });
  }, []);

  const resizeWindow = useCallback((name: string, width: number, height: number) => {
    window.compositor?.action('resize', { window: name, width, height });
  }, []);

  const moveWindow = useCallback((name: string, x: number, y: number) => {
    window.compositor?.action('move', { window: name, x, y });
  }, []);

  return {
    windows,
    focusedWindow,
    focusWindow,
    minimizeWindow,
    closeWindow,
    maximizeWindow,
    resizeWindow,
    moveWindow,
  };
}
