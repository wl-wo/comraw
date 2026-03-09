/**
 * Module-level pixel buffer store.
 * Kept outside React state to avoid re-render cascades when pixel data
 * updates every frame (~60fps per window).
 */

type BufferEntry = {
  buffer: Uint8Array;
  width: number;
  height: number;
  stride: number;
  generation: number;
};

const store = new Map<string, BufferEntry>();
const listeners = new Map<string, Set<() => void>>();
let generation = 0;

export function updatePixelBuffer(
  name: string,
  buffer: Uint8Array,
  width: number,
  height: number,
  stride: number,
) {
  store.set(name, { buffer, width, height, stride, generation: ++generation });
  listeners.get(name)?.forEach((cb) => cb());
}

export function getPixelBuffer(name: string): BufferEntry | undefined {
  return store.get(name);
}

export function removePixelBuffer(name: string) {
  store.delete(name);
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
