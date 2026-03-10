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

      // Data arrives pre-converted to RGBA from the compositor — direct copy, no per-pixel swap.
      const dst8 = new Uint8Array(imgData.data.buffer);
      const bytesPerRow = pw * 4;
      const fastContiguous = stride === bytesPerRow;

      // When damage rects are available and canvas size hasn't changed,
      // only copy and blit the damaged regions.
      const usePartial = !sizeChanged && damageRects && damageRects.length > 0 && damageRects.length < 64;

      if (usePartial) {
        for (const r of damageRects!) {
          const rx = Math.max(0, r.x);
          const ry = Math.max(0, r.y);
          const rw = Math.min(pw - rx, r.width);
          const rh = Math.min(ph - ry, r.height);
          if (rw <= 0 || rh <= 0) continue;
          const rowBytes = rw * 4;
          for (let y = ry; y < ry + rh; y++) {
            const srcOff = y * stride + rx * 4;
            const dstOff = y * bytesPerRow + rx * 4;
            dst8.set(buffer.subarray(srcOff, srcOff + rowBytes), dstOff);
          }
          ctx.putImageData(imgData, 0, 0, rx, ry, rw, rh);
        }
      } else if (fastContiguous) {
        // Optimal path: single bulk copy
        dst8.set(buffer.subarray(0, bytesPerRow * ph));
        ctx.putImageData(imgData, 0, 0);
      } else {
        // Stride mismatch: copy row by row
        for (let y = 0; y < ph; y++) {
          const srcOff = y * stride;
          const dstOff = y * bytesPerRow;
          dst8.set(buffer.subarray(srcOff, srcOff + bytesPerRow), dstOff);
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
