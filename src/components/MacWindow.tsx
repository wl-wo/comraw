import { memo, useEffect, useRef, useState, useCallback } from 'react';
import type { CompositorWindow } from '../hooks/useWindowManager';
import { WindowCanvas } from './WindowCanvas';

interface MacWindowProps {
  win: CompositorWindow;
  isFocused: boolean;
  isClosing?: boolean;
  zIndex: number;
  shellUiActive?: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onResize: (w: number, h: number) => void;
  onMove: (x: number, y: number) => void;
}

/** Height of the title bar in pixels — must match TITLE_H in xdg_shell.rs */
const TITLE_H = 30;

/** Map browser MouseEvent.button to Linux evdev button code */
function toEvdevButton(btn: number): number {
  if (btn === 2) return 273; // BTN_RIGHT
  if (btn === 1) return 274; // BTN_MIDDLE
  return 272; // BTN_LEFT
}

const CODE_TO_EVDEV: Record<string, number> = {
  Escape: 1, Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5, Digit5: 6,
  Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10, Digit0: 11, Minus: 12,
  Equal: 13, Backspace: 14, Tab: 15, KeyQ: 16, KeyW: 17, KeyE: 18, KeyR: 19,
  KeyT: 20, KeyY: 21, KeyU: 22, KeyI: 23, KeyO: 24, KeyP: 25,
  BracketLeft: 26, BracketRight: 27, Enter: 28, ControlLeft: 29,
  KeyA: 30, KeyS: 31, KeyD: 32, KeyF: 33, KeyG: 34, KeyH: 35, KeyJ: 36,
  KeyK: 37, KeyL: 38, Semicolon: 39, Quote: 40, Backquote: 41,
  ShiftLeft: 42, Backslash: 43, KeyZ: 44, KeyX: 45, KeyC: 46, KeyV: 47,
  KeyB: 48, KeyN: 49, KeyM: 50, Comma: 51, Period: 52, Slash: 53,
  ShiftRight: 54, NumpadMultiply: 55, AltLeft: 56, Space: 57, CapsLock: 58,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64, F7: 65, F8: 66,
  F9: 67, F10: 68, NumLock: 69, ScrollLock: 70, Numpad7: 71, Numpad8: 72,
  Numpad9: 73, NumpadSubtract: 74, Numpad4: 75, Numpad5: 76, Numpad6: 77,
  NumpadAdd: 78, Numpad1: 79, Numpad2: 80, Numpad3: 81, Numpad0: 82,
  NumpadDecimal: 83, F11: 87, F12: 88, NumpadEnter: 96, ControlRight: 97,
  NumpadDivide: 98, PrintScreen: 99, AltRight: 100, Home: 102, ArrowUp: 103,
  PageUp: 104, ArrowLeft: 105, ArrowRight: 106, End: 107, ArrowDown: 108,
  PageDown: 109, Insert: 110, Delete: 111, MetaLeft: 125, MetaRight: 126,
  ContextMenu: 127,
};

function codeToEvdev(code: string): number | undefined {
  return CODE_TO_EVDEV[code];
}

export const MacWindow = memo(function MacWindow({
  win,
  isFocused,
  isClosing = false,
  zIndex,
  shellUiActive = false,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onResize,
  onMove,
}: MacWindowProps) {
  const hasServerChrome = win.ssd !== false;
  const contentRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: win.x, y: win.y });
  const [size, setSize] = useState({ w: win.width, h: win.height });
  const dragging = useRef<{ ox: number; oy: number } | null>(null);
  const resizing = useRef<{ ox: number; oy: number; sw: number; sh: number } | null>(null);
  const dragRaf = useRef<number | null>(null);
  const resizeRaf = useRef<number | null>(null);
  const pointerMotionRaf = useRef<number | null>(null);
  const pendingDragPos = useRef<{ x: number; y: number } | null>(null);
  const pendingResizeSize = useRef<{ w: number; h: number } | null>(null);
  const pendingMotion = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!dragging.current) setPos({ x: win.x, y: win.y });
  }, [win.x, win.y]);

  useEffect(() => {
    if (!resizing.current) setSize({ w: win.width, h: win.height });
  }, [win.width, win.height]);

  const prevFocusedRef = useRef(false);
  useEffect(() => {
    const wasFocused = prevFocusedRef.current;
    prevFocusedRef.current = isFocused;
    // Only grab DOM focus on actual focus transitions (false → true),
    // not on every re-render where isFocused is already true.
    if (isFocused && !wasFocused && !shellUiActive && contentRef.current) {
      contentRef.current.focus({ preventScroll: true });
    }
  }, [isFocused, shellUiActive]);

  // ── Drag (DOM-direct + rAF) ─────────────────────────────────────────────
  const onTitleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!hasServerChrome || (e.target as HTMLElement).closest('[data-control]')) return;
    e.preventDefault();
    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragging.current = { ox: e.clientX - rect.left, oy: e.clientY - rect.top };
    onFocus();

    const handleDragMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const nx = ev.clientX - dragging.current.ox;
      const ny = ev.clientY - dragging.current.oy;
      pendingDragPos.current = { x: nx, y: ny };
      if (dragRaf.current === null) {
        dragRaf.current = requestAnimationFrame(() => {
          dragRaf.current = null;
          const p = pendingDragPos.current;
          if (p && el) {
            el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
          }
        });
      }
    };
    const handleDragUp = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const nx = ev.clientX - dragging.current.ox;
      const ny = ev.clientY - dragging.current.oy;
      dragging.current = null;
      pendingDragPos.current = null;
      if (dragRaf.current !== null) {
        cancelAnimationFrame(dragRaf.current);
        dragRaf.current = null;
      }
      setPos({ x: nx, y: ny });
      onMove(nx, ny);
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragUp);
    };
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragUp);
  }, [hasServerChrome, onFocus, onMove]);

  // ── Resize (DOM-direct + rAF) ───────────────────────────────────────────
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (!hasServerChrome) return;
    e.preventDefault();
    e.stopPropagation();
    const el = windowRef.current;
    if (!el) return;
    resizing.current = { ox: e.clientX, oy: e.clientY, sw: el.offsetWidth, sh: el.offsetHeight };
    onFocus();

    const MIN = 280;
    const handleResizeMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const { ox, oy, sw, sh } = resizing.current;
      const nw = Math.max(MIN, sw + ev.clientX - ox);
      const nh = Math.max(MIN, sh + ev.clientY - oy);
      pendingResizeSize.current = { w: nw, h: nh };
      if (resizeRaf.current === null) {
        resizeRaf.current = requestAnimationFrame(() => {
          resizeRaf.current = null;
          const s = pendingResizeSize.current;
          if (s && el) {
            el.style.width = s.w + 'px';
            el.style.height = s.h + 'px';
          }
        });
      }
    };
    const handleResizeUp = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const { ox, oy, sw, sh } = resizing.current;
      const nw = Math.max(MIN, sw + ev.clientX - ox);
      const nh = Math.max(MIN, sh + ev.clientY - oy);
      resizing.current = null;
      pendingResizeSize.current = null;
      if (resizeRaf.current !== null) {
        cancelAnimationFrame(resizeRaf.current);
        resizeRaf.current = null;
      }
      setSize({ w: nw, h: nh });
      onResize(nw, hasServerChrome ? nh - TITLE_H : nh);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeUp);
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeUp);
  }, [hasServerChrome, onFocus, onResize]);

  // ── Pointer forwarding to compositor (rAF-throttled motion) ─────────────
  const onContentMouse = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    switch (e.type) {
      case 'mousemove':
        pendingMotion.current = { x, y };
        if (pointerMotionRaf.current === null) {
          pointerMotionRaf.current = requestAnimationFrame(() => {
            pointerMotionRaf.current = null;
            const m = pendingMotion.current;
            if (m) {
              window.compositor?.action('pointer_motion' as never, { window: win.name, ...m });
            }
          });
        }
        break;
      case 'mousedown':
        onFocus();
        window.compositor?.action('pointer_button' as never, {
          window: win.name, x, y,
          button: toEvdevButton(e.button), pressed: true,
        });
        break;
      case 'mouseup':
        window.compositor?.action('pointer_button' as never, {
          window: win.name, x, y,
          button: toEvdevButton(e.button), pressed: false,
        });
        break;
      case 'mouseleave':
        window.compositor?.action('pointer_leave' as never, { window: win.name });
        break;
    }
  }, [win.name, onFocus]);

  const onContentWheel = useCallback((e: React.WheelEvent) => {
    window.compositor?.action('pointer_scroll' as never, {
      window: win.name,
      dx: Math.round(e.deltaX),
      dy: Math.round(e.deltaY),
    });
  }, [win.name]);

  const onContentKey = useCallback((e: React.KeyboardEvent) => {
    if (win.source !== 'wayland' && win.source !== 'x11') {
      return;
    }
    const evdev = codeToEvdev(e.code);
    if (evdev === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    const pressed = e.type === 'keydown';
    window.compositor?.forwardKeyboard?.(win.name, evdev, pressed, e.timeStamp | 0);
  }, [win.name, win.source]);

  const title = win.title || win.app_id || win.name;

  // Cleanup pending rAFs on unmount
  useEffect(() => {
    return () => {
      if (dragRaf.current !== null) cancelAnimationFrame(dragRaf.current);
      if (resizeRaf.current !== null) cancelAnimationFrame(resizeRaf.current);
      if (pointerMotionRaf.current !== null) cancelAnimationFrame(pointerMotionRaf.current);
    };
  }, []);

  return (
    <div
      ref={windowRef}
      className={`wo-window${isFocused ? ' focused' : ''}${!hasServerChrome ? ' csd' : ''}${isClosing ? ' closing' : ''}${win.dialog ? ' dialog' : ''}`}
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, width: size.w, height: size.h, zIndex }}
      onMouseDown={onFocus}
    >
      {hasServerChrome && (
        <div className="wo-titlebar" onMouseDown={onTitleMouseDown}>
          <div className="wo-traffic-lights" data-control>
            <button
              className="wo-btn wo-btn-close"
              aria-label="Close"
              data-control
              onClick={(e) => { e.stopPropagation(); onClose(); }}
            />
            <button
              className="wo-btn wo-btn-min"
              aria-label="Minimize"
              data-control
              onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            />
            <button
              className="wo-btn wo-btn-max"
              aria-label="Maximize"
              data-control
              onClick={(e) => { e.stopPropagation(); onMaximize(); }}
            />
          </div>
          <span className="wo-title">{title}</span>
        </div>
      )}

      {/* Content — pointer and keyboard events forwarded to compositor */}
      <div
        className="wo-content"
        ref={contentRef}
        tabIndex={0}
        onMouseMove={onContentMouse}
        onMouseDown={onContentMouse}
        onMouseUp={onContentMouse}
        onMouseLeave={onContentMouse}
        onWheel={onContentWheel}
        onKeyDown={onContentKey}
        onKeyUp={onContentKey}
      >
        <WindowCanvas windowName={win.name} />
      </div>

      {hasServerChrome && (
        <div className="wo-resize-grip" onMouseDown={onResizeMouseDown} />
      )}
    </div>
  );
});
