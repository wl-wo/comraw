/**
 * Module-level pixel buffer store.
 * Kept outside React state to avoid re-render cascades when pixel data
 * updates every frame (~60fps per window).
 *
 * Supports two modes:
 * 1. SAB (SharedArrayBuffer) — zero-copy: the main process writes pixels
 *    directly into a SAB that we wrap in a Uint8Array.  No IPC copy.
 * 2. Legacy Uint8Array — structured-clone fallback when SAB isn't available.
 */

type DamageRect = { x: number; y: number; width: number; height: number };

type BufferEntry = {
  buffer: Uint8Array;
  width: number;
  height: number;
  stride: number;
  generation: number;
  damageRects?: DamageRect[];
};

const store = new Map<string, BufferEntry>();
const sabStore = new Map<string, { sab: SharedArrayBuffer; view: Uint8Array; width: number; height: number; stride: number }>();
const listeners = new Map<string, Set<() => void>>();
let generation = 0;

/** Register a SharedArrayBuffer for a window (called when SAB is created/resized). */
export function registerSab(
  name: string,
  sab: SharedArrayBuffer,
  width: number,
  height: number,
  stride: number,
) {
  const view = new Uint8Array(sab);
  sabStore.set(name, { sab, view, width, height, stride });

  // Seed the store immediately so canvases can render even if an update
  // notification is delayed. The next surface-update will bump generation.
  store.set(name, {
    buffer: view,
    width,
    height,
    stride,
    generation: ++generation,
  });
  listeners.get(name)?.forEach((cb) => cb());
}

/**
 * Signal that the SAB contents have been updated (lightweight, no pixel data).
 * The renderer will read directly from the registered SAB.
 */
export function signalSabUpdate(
  name: string,
  width: number,
  height: number,
  stride: number,
  damageRects?: DamageRect[],
) {
  const sabEntry = sabStore.get(name);
  if (!sabEntry) return;
  // Point the store entry at the SAB view — zero-copy
  store.set(name, {
    buffer: sabEntry.view,
    width,
    height,
    stride,
    generation: ++generation,
    damageRects,
  });
  listeners.get(name)?.forEach((cb) => cb());
}

/** Legacy path: update with a copied Uint8Array buffer. */
export function updatePixelBuffer(
  name: string,
  buffer: Uint8Array,
  width: number,
  height: number,
  stride: number,
  damageRects?: DamageRect[],
) {
  store.set(name, { buffer, width, height, stride, generation: ++generation, damageRects });
  listeners.get(name)?.forEach((cb) => cb());
}

export function getPixelBuffer(name: string): BufferEntry | undefined {
  return store.get(name);
}

export function removePixelBuffer(name: string) {
  store.delete(name);
  sabStore.delete(name);
  listeners.delete(name);
}

export function onPixelBufferUpdate(
  name: string,
  callback: () => void,
): () => void {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name)!.add(callback);
  return () => {
    listeners.get(name)?.delete(callback);
  };
}
