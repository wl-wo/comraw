import { memo, useEffect, useRef } from 'react';
import { getPixelBuffer, onPixelBufferUpdate } from '../stores/pixelBufferStore';

interface WindowCanvasProps {
  windowName: string;
}

export const WindowCanvas = memo(function WindowCanvas({ windowName }: WindowCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const imageWRef = useRef(0);
  const imageHRef = useRef(0);

  useEffect(() => {
    let frameId = 0;
    let lastGen = -1;

    const paint = () => {
      frameId = 0;
      const entry = getPixelBuffer(windowName);
      const canvas = canvasRef.current;
      if (!canvas || !entry || entry.generation === lastGen) return;
      lastGen = entry.generation;

      const { buffer, width: pw, height: ph, stride, damageRects } = entry;
      if (pw <= 0 || ph <= 0 || stride < pw * 4 || buffer.length < stride * ph) return;

      const sizeChanged = canvas.width !== pw || canvas.height !== ph;
      if (sizeChanged) {
        canvas.width = pw;
        canvas.height = ph;
      }

      let ctx = ctxRef.current;
      if (!ctx) {
        ctx = canvas.getContext('2d');
        ctxRef.current = ctx;
      }
      if (!ctx) return;

      let imgData = imageDataRef.current;
      if (!imgData || imageWRef.current !== pw || imageHRef.current !== ph) {
        imgData = ctx.createImageData(pw, ph);
        imageDataRef.current = imgData;
        imageWRef.current = pw;
        imageHRef.current = ph;
      }

      const dst32 = new Uint32Array(imgData.data.buffer);
      const aligned = (buffer.byteOffset & 0x3) === 0;
      const bytesPerRow = pw * 4;
      const fastContiguous = stride === bytesPerRow && aligned;

      // When damage rects are available and canvas size hasn't changed,
      // only convert and blit the damaged regions.
      const usePartial = !sizeChanged && damageRects && damageRects.length > 0 && damageRects.length < 64;

      if (usePartial && fastContiguous) {
        const src32 = new Uint32Array(buffer.buffer, buffer.byteOffset, pw * ph);
        for (const r of damageRects!) {
          const rx = Math.max(0, r.x);
          const ry = Math.max(0, r.y);
          const rw = Math.min(pw - rx, r.width);
          const rh = Math.min(ph - ry, r.height);
          if (rw <= 0 || rh <= 0) continue;
          for (let y = ry; y < ry + rh; y++) {
            let idx = y * pw + rx;
            for (let x = 0; x < rw; x++, idx++) {
              const pixel = src32[idx];
              dst32[idx] =
                (pixel & 0xff00ff00) |
                ((pixel & 0x00ff0000) >>> 16) |
                ((pixel & 0x000000ff) << 16);
            }
          }
          ctx.putImageData(imgData, 0, 0, rx, ry, rw, rh);
        }
      } else if (usePartial && aligned) {
        const src32 = new Uint32Array(buffer.buffer, buffer.byteOffset, (stride * ph) >>> 2);
        const srcStride32 = stride >>> 2;
        for (const r of damageRects!) {
          const rx = Math.max(0, r.x);
          const ry = Math.max(0, r.y);
          const rw = Math.min(pw - rx, r.width);
          const rh = Math.min(ph - ry, r.height);
          if (rw <= 0 || rh <= 0) continue;
          for (let y = ry; y < ry + rh; y++) {
            let srcIndex = y * srcStride32 + rx;
            let dstIndex = y * pw + rx;
            for (let x = 0; x < rw; x++, srcIndex++, dstIndex++) {
              const pixel = src32[srcIndex];
              dst32[dstIndex] =
                (pixel & 0xff00ff00) |
                ((pixel & 0x00ff0000) >>> 16) |
                ((pixel & 0x000000ff) << 16);
            }
          }
          ctx.putImageData(imgData, 0, 0, rx, ry, rw, rh);
        }
      } else {
        // Full-frame fallback
        if (fastContiguous) {
          const src32 = new Uint32Array(buffer.buffer, buffer.byteOffset, pw * ph);
          for (let index = 0; index < src32.length; index++) {
            const pixel = src32[index];
            dst32[index] =
              (pixel & 0xff00ff00) |
              ((pixel & 0x00ff0000) >>> 16) |
              ((pixel & 0x000000ff) << 16);
          }
        } else if (aligned) {
          const src32 = new Uint32Array(buffer.buffer, buffer.byteOffset, (stride * ph) >>> 2);
          const srcStride32 = stride >>> 2;
          for (let y = 0; y < ph; y++) {
            let srcIndex = y * srcStride32;
            let dstIndex = y * pw;
            for (let x = 0; x < pw; x++, srcIndex++, dstIndex++) {
              const pixel = src32[srcIndex];
              dst32[dstIndex] =
                (pixel & 0xff00ff00) |
                ((pixel & 0x00ff0000) >>> 16) |
                ((pixel & 0x000000ff) << 16);
            }
          }
        } else {
          const src8 = buffer;
          for (let y = 0; y < ph; y++) {
            const srcRow = y * stride;
            let dstIndex = y * pw;
            for (let x = 0; x < pw; x++, dstIndex++) {
              const p = srcRow + (x << 2);
              const b = src8[p];
              const g = src8[p + 1];
              const r = src8[p + 2];
              const a = src8[p + 3];
              dst32[dstIndex] =
                (a << 24) |
                (b << 16) |
                (g << 8) |
                r;
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
    };

    const onUpdate = () => {
      if (!frameId) frameId = requestAnimationFrame(paint);
    };

    const unsub = onPixelBufferUpdate(windowName, onUpdate);
    onUpdate();

    return () => {
      unsub();
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [windowName]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
    />
  );
});
