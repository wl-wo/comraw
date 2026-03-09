import { useEffect, useState, useCallback, useMemo } from "react";
import "./App.css";
import { useWindowManager } from "./hooks/useWindowManager";
import { MacWindow } from "./components/MacWindow";
import { Panel } from "./components/Panel";
import type { TrayIcon } from "./components/SystemTray";
import { AppLauncher } from "./components/AppLauncher";
import { AltTab } from "./components/AltTab";
import { Dock } from "./components/Dock";
import { ScreenShareDialog } from "./components/ScreenShareDialog";
import { NotificationCenter } from "./components/NotificationCenter";
import {
  NotificationToast,
  type NotificationItem,
} from "./components/NotificationToast";
import type { NotificationData } from "@wl-wo/wo-types";

let toastIdSeq = 0;

type DBusMenuItem = {
  id: string;
  label: string;
  enabled?: boolean;
  children?: DBusMenuItem[];
};

/** Map browser KeyboardEvent.code to Linux evdev keycode */
const BROWSER_CODE_TO_EVDEV: Record<string, number> = {
  Escape: 1,
  Digit1: 2,
  Digit2: 3,
  Digit3: 4,
  Digit4: 5,
  Digit5: 6,
  Digit6: 7,
  Digit7: 8,
  Digit8: 9,
  Digit9: 10,
  Digit0: 11,
  Minus: 12,
  Equal: 13,
  Backspace: 14,
  BackSpace: 14, // Alternative spelling for some keyboards
  Tab: 15,
  KeyQ: 16,
  KeyW: 17,
  KeyE: 18,
  KeyR: 19,
  KeyT: 20,
  KeyY: 21,
  KeyU: 22,
  KeyI: 23,
  KeyO: 24,
  KeyP: 25,
  BracketLeft: 26,
  BracketRight: 27,
  Enter: 28,
  ControlLeft: 29,
  KeyA: 30,
  KeyS: 31,
  KeyD: 32,
  KeyF: 33,
  KeyG: 34,
  KeyH: 35,
  KeyJ: 36,
  KeyK: 37,
  KeyL: 38,
  Semicolon: 39,
  Quote: 40,
  Backquote: 41,
  ShiftLeft: 42,
  Backslash: 43,
  KeyZ: 44,
  KeyX: 45,
  KeyC: 46,
  KeyV: 47,
  KeyB: 48,
  KeyN: 49,
  KeyM: 50,
  Comma: 51,
  Period: 52,
  Slash: 53,
  ShiftRight: 54,
  NumpadMultiply: 55,
  AltLeft: 56,
  Space: 57,
  CapsLock: 58,
  F1: 59,
  F2: 60,
  F3: 61,
  F4: 62,
  F5: 63,
  F6: 64,
  F7: 65,
  F8: 66,
  F9: 67,
  F10: 68,
  NumLock: 69,
  ScrollLock: 70,
  Numpad7: 71,
  Numpad8: 72,
  Numpad9: 73,
  NumpadSubtract: 74,
  Numpad4: 75,
  Numpad5: 76,
  Numpad6: 77,
  NumpadAdd: 78,
  Numpad1: 79,
  Numpad2: 80,
  Numpad3: 81,
  Numpad0: 82,
  NumpadDecimal: 83,
  F11: 87,
  F12: 88,
  NumpadEnter: 96,
  ControlRight: 97,
  NumpadDivide: 98,
  PrintScreen: 99,
  AltRight: 100,
  Home: 102,
  ArrowUp: 103,
  PageUp: 104,
  ArrowLeft: 105,
  ArrowRight: 106,
  End: 107,
  ArrowDown: 108,
  PageDown: 109,
  Insert: 110,
  Delete: 111,
  MetaLeft: 125,
  MetaRight: 126,
  Pause: 119,
};

const BROWSER_KEY_TO_EVDEV: Record<string, number> = {
  " ": 57,
  Spacebar: 57,
  Backspace: 14,
  Tab: 15,
  Enter: 28,
  Escape: 1,
  ArrowUp: 103,
  ArrowDown: 108,
  ArrowLeft: 105,
  ArrowRight: 106,
  Delete: 111,
  Insert: 110,
  Home: 102,
  End: 107,
  PageUp: 104,
  PageDown: 109,
};

function resolveEvdevKey(e: KeyboardEvent): number | undefined {
  const byCode = BROWSER_CODE_TO_EVDEV[e.code];
  if (byCode !== undefined) return byCode;

  if (e.key === "Control") return e.location === 2 ? 97 : 29;
  if (e.key === "Shift") return e.location === 2 ? 54 : 42;
  if (e.key === "Alt") return e.location === 2 ? 100 : 56;
  if (e.key === "Meta") return e.location === 2 ? 126 : 125;

  return BROWSER_KEY_TO_EVDEV[e.key];
}

function App() {
  const {
    windows,
    focusedWindow,
    focusWindow,
    minimizeWindow,
    closeWindow,
    maximizeWindow,
    resizeWindow,
    moveWindow,
  } = useWindowManager();

  const [minimized, setMinimized] = useState<Record<string, boolean>>({});
  const [closing, setClosing] = useState<Record<string, boolean>>({});
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [altTabOpen, setAltTabOpen] = useState(false);
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [screenShareRequest, setScreenShareRequest] = useState<{
    requestId: string;
    appName: string;
  } | null>(null);
  const [trayItems, setTrayItems] = useState<Array<{
    id: string;
    title: string;
    status?: "active" | "passive" | "attention";
    icon?: string;
    iconDataUrl?: string;
    service: string;
    objectPath: string;
    hasMenu?: boolean;
    menuPath?: string;
  }>>([]);
  const [trayMenus, setTrayMenus] = useState<Record<string, DBusMenuItem[]>>({});

  // Subscribe to compositor notifications
  useEffect(() => {
    const unsub = window.compositor?.onNotification?.(
      (data: NotificationData) => {
        const item: NotificationItem = {
          id: `t-${++toastIdSeq}`,
          title: data.title,
          body: data.body,
          icon: data.icon,
          timeout: data.timeout ?? 5000,
          timestamp: data.timestamp ?? Date.now(),
        };
        setToasts((prev) => [item, ...prev].slice(0, 4));
        setNotifications((prev) => [item, ...prev].slice(0, 100));
        if (!notificationCenterOpen) {
          setUnreadNotifications((prev) => prev + 1);
        }
      },
    );
    return () => unsub?.();
  }, [notificationCenterOpen]);

  useEffect(() => {
    const onPortalRequest = (data: {
      requestId: string;
      kind: string;
      appName?: string;
      sessionId?: string;
    }) => {
      if (data.kind !== 'screen_share') {
        return;
      }
      setScreenShareRequest({
        requestId: data.requestId,
        appName: data.appName || 'Application',
      });
    };

    const unsub = window.compositor?.onPortalRequest?.(onPortalRequest);
    return () => unsub?.();
  }, []);

  const handleScreenShareResponse = useCallback(
    async (allowed: boolean, type?: 'screen' | 'window', windowName?: string) => {
      if (screenShareRequest) {
        await window.compositor?.syscall("portal_respond", {
          requestId: screenShareRequest.requestId,
          allowed,
          type: type || 'screen',
          windowName: windowName || null,
        });
        setScreenShareRequest(null);
      }
    },
    [screenShareRequest],
  );

  useEffect(() => {
    // Global keyboard handler for Alt+Tab
    const onGlobalKey = (e: KeyboardEvent) => {
      // Alt+Tab: open window switcher
      if (e.key === "Tab" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (!altTabOpen && windows.length > 1) {
          setAltTabOpen(true);
        }
        return;
      }
    };

    document.addEventListener("keydown", onGlobalKey);

    // Window-specific forwarding for focused Wayland/X11 windows
    if (!focusedWindow) {
      return () => document.removeEventListener("keydown", onGlobalKey);
    }
    const isNativeClient = windows.some(
      (w) =>
        w.name === focusedWindow && (w.source === "wayland" || w.source === "x11"),
    );
    if (!isNativeClient) {
      return () => document.removeEventListener("keydown", onGlobalKey);
    }

    const onKey = (e: KeyboardEvent) => {
      // Don't intercept global shortcuts
      if (e.altKey && e.key === "Tab") return;

      // Check if event target is an editable element (let browser handle natively)
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.contentEditable === "true" ||
        target?.contentEditable === "plaintext-only";

      if (isEditable) {
        // Allow browser to handle input/textarea/select/contentEditable natively
        return;
      }

      const inNativeContent = Boolean(target?.closest?.(".wo-content"));
      const inUiControl = Boolean(
        target?.closest?.(
          "button, [role='button'], a, .wo-panel, .wo-desktop-widgets, .wo-dock, .wo-launcher, .wo-alt-tab, .wo-toast-stack",
        ),
      );

      if (!inNativeContent && !document.pointerLockElement) {
        if (inUiControl) {
          return;
        }
      }

      const keycode = resolveEvdevKey(e);
      if (keycode === undefined) {
        // Log unknown keys for debugging
        if (e.code && !["Unidentified", ""].includes(e.code)) {
          console.debug("Unknown key code:", e.code, "key:", e.key);
        }
        return;
      }

      // Prevent default browser behavior (scrolling, etc.) for keys we're forwarding
      e.preventDefault();
      window.compositor?.forwardKeyboard?.(
        focusedWindow,
        keycode,
        e.type === "keydown",
        e.timeStamp
      );
    };

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKey, true);
    return () => {
      document.removeEventListener("keydown", onGlobalKey);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keyup", onKey, true);
    };
  }, [focusedWindow, windows, altTabOpen]);

  // Pointer Lock & Relative Motion handling
  useEffect(() => {
    const onLockRequest = (data: { window: string; lock: boolean }) => {
      if (data.lock) {
        // Request browser pointer lock
        document.body.requestPointerLock();
      } else if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    };

    const unsub = window.compositor?.onPointerLockRequest?.(onLockRequest);

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement && focusedWindow) {
        window.compositor?.forwardRelativePointer?.(focusedWindow, e.movementX, e.movementY);
      }
    };

    document.addEventListener("mousemove", onMouseMove);

    return () => {
      unsub?.();
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, [focusedWindow]);

  // Environment variable updates from compositor (e.g. DISPLAY after XWayland)
  useEffect(() => {
    const unsub = window.compositor?.onEnvUpdate?.((vars) => {
      console.log("[comraw] env update from compositor:", vars);
    });
    return () => unsub?.();
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadNotifications(0);
  }, []);

  const handleNotificationToggle = useCallback(() => {
    setNotificationCenterOpen((open) => {
      const next = !open;
      if (next) {
        setUnreadNotifications(0);
      }
      return next;
    });
  }, []);

  const handleNotificationCenterClose = useCallback(() => {
    setNotificationCenterOpen(false);
  }, []);

  const showToast = useCallback((title: string, body = '', icon?: string, timeout = 4000) => {
    const item: NotificationItem = {
      id: `t-${++toastIdSeq}`,
      title,
      body,
      icon,
      timeout,
      timestamp: Date.now(),
    };
    setToasts((prev) => [item, ...prev].slice(0, 4));
  }, []);

  const handlePowerAction = useCallback(
    async (action: 'lock' | 'sleep' | 'restart' | 'shutdown' | 'logout') => {
      const confirmMessage: Partial<Record<typeof action, string>> = {
        shutdown: 'Shut down the system now?',
        restart: 'Restart the system now?',
        logout: 'Log out of this session now?',
      };

      const message = confirmMessage[action];
      if (message && !window.confirm(message)) {
        return;
      }

      try {
        const result = await window.compositor?.syscall(action, {});
        if (result?.ok === false) {
          throw new Error(typeof result.error === 'string' ? result.error : `Failed to ${action}`);
        }
        if (action === 'lock') {
          showToast('Screen locked', '', 'mdi:lock-outline', 2000);
        }
      } catch (error) {
        showToast(
          'Power action failed',
          error instanceof Error ? error.message : String(error),
          'mdi:alert-circle-outline',
          5000,
        );
      }
    },
    [showToast],
  );

  const focusedAppName = useMemo(() => {
    if (!focusedWindow) return undefined;
    const w = windows.find((win) => win.name === focusedWindow);
    return w?.title || w?.app_id || w?.name;
  }, [focusedWindow, windows]);

  useEffect(() => {
    let alive = true;

    const loadTrayItems = async () => {
      try {
        const result = await window.compositor?.syscall("tray_list", {});
        if (!alive || !Array.isArray(result)) {
          return;
        }
        const next = result
          .filter((item): item is {
            id: string;
            title: string;
            status?: "active" | "passive" | "attention";
            icon?: string;
            iconDataUrl?: string;
            service: string;
            objectPath: string;
            hasMenu?: boolean;
            menuPath?: string;
          } => Boolean(item && typeof item.id === "string" && typeof item.service === "string" && typeof item.objectPath === "string"))
          .map((item) => ({
            id: item.id,
            title: item.title || item.id,
            status: item.status,
            icon: item.icon || "mdi:circle-medium",
            iconDataUrl: typeof item.iconDataUrl === "string" ? item.iconDataUrl : undefined,
            service: item.service,
            objectPath: item.objectPath,
            hasMenu: Boolean(item.hasMenu),
            menuPath: item.menuPath || "/com/canonical/dbusmenu",
          }));
        setTrayItems(next);
      } catch {
        if (alive) {
          setTrayItems([]);
        }
      }
    };

    loadTrayItems();
    const id = window.setInterval(loadTrayItems, 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const loadMenuItems = async () => {
      const nextMenus: Record<string, DBusMenuItem[]> = {};
      for (const item of trayItems) {
        if (item.hasMenu && item.service && item.menuPath && alive) {
          try {
            const items = await window.compositor?.syscall("tray_menu_items", {
              service: item.service,
              menuPath: item.menuPath,
            });
            if (Array.isArray(items) && items.length > 0) {
              nextMenus[item.id] = items as DBusMenuItem[];
            }
          } catch {
            // silently skip items with menu fetch errors
          }
        }
      }
      if (alive) {
        setTrayMenus(nextMenus);
      }
    };

    loadMenuItems();
    return () => {
      alive = false;
    };
  }, [trayItems]);

  const trayIcons = useMemo<TrayIcon[]>(
    () =>
      trayItems.map((item) => {
        // Build menu from DBusMenu items if available, otherwise use standard actions
        const menuItems = trayMenus[item.id];
        const menu = menuItems && menuItems.length > 0
          ? menuItems.map((mi: DBusMenuItem) => ({
              id: `${item.id}:${mi.id}`,
              label: mi.label || mi.id,
              icon: "mdi:menu",
              enabled: mi.enabled !== false,
              onClick: () => {
                void window.compositor?.syscall("tray_menu_event", {
                  service: item.service,
                  menuPath: item.menuPath,
                  menuId: mi.id,
                });
              },
            }))
          : [
              {
                id: `${item.id}:activate`,
                label: "Activate",
                icon: "mdi:gesture-tap",
                onClick: () => {
                  void window.compositor?.syscall("tray_activate", {
                    service: item.service,
                    objectPath: item.objectPath,
                  });
                },
              },
              {
                id: `${item.id}:secondary`,
                label: "Secondary Action",
                icon: "mdi:gesture-double-tap",
                onClick: () => {
                  void window.compositor?.syscall("tray_secondary_activate", {
                    service: item.service,
                    objectPath: item.objectPath,
                  });
                },
              },
              {
                id: `${item.id}:menu`,
                label: "Open Native Menu",
                icon: "mdi:dots-horizontal",
                enabled: item.hasMenu,
                onClick: () => {
                  void window.compositor?.syscall("tray_context_menu", {
                    service: item.service,
                    objectPath: item.objectPath,
                    x: 0,
                    y: 0,
                  });
                },
              },
            ];
        return {
          id: item.id,
          title: item.title,
          icon: item.iconDataUrl || item.icon || "mdi:circle-medium",
          status: item.status,
          onClick: () => {
            void window.compositor?.syscall("tray_activate", {
              service: item.service,
              objectPath: item.objectPath,
            });
          },
          onContextMenu: () => {
            void window.compositor?.syscall("tray_context_menu", {
              service: item.service,
              objectPath: item.objectPath,
              x: 0,
              y: 0,
            });
          },
          menu,
        };
      }),
    [trayItems, trayMenus],
  );

  useEffect(() => {
    setMinimized((prev) => {
      const next = { ...prev };
      for (const w of windows) {
        if (w.mapped === false) next[w.name] = true;
        else delete next[w.name];
      }
      return next;
    });
  }, [windows]);

  const sortedWindows = useMemo(
    () => {
      const filtered = windows
        .filter(
          (w) => w.name !== "main" && w.mapped !== false && !minimized[w.name],
        );
      
      const parentMap = new Map<string, typeof filtered>();
      const roots: typeof filtered = [];
      
      for (const w of filtered) {
        if (w.dialog && w.parent_name) {
          const siblings = parentMap.get(w.parent_name) || [];
          siblings.push(w);
          parentMap.set(w.parent_name, siblings);
        } else {
          roots.push(w);
        }
      }
      
      const sorted: typeof filtered = [];
      const addWithDialogs = (win: typeof filtered[0]) => {
        sorted.push(win);
        const dialogs = parentMap.get(win.name);
        if (dialogs) {
          dialogs.sort((a, b) => (a.z_order ?? 0) - (b.z_order ?? 0));
          dialogs.forEach(addWithDialogs);
        }
      };
      
      roots.sort((a, b) => (a.z_order ?? 0) - (b.z_order ?? 0));
      roots.forEach(addWithDialogs);
      
      return sorted;
    },
    [windows, minimized],
  );

  const minimizedWindows = useMemo(
    () => windows.filter((w) => minimized[w.name] && w.name !== "main"),
    [windows, minimized],
  );

  const zOf = useCallback(
    (name: string, idx: number) => {
      const baseZ = 100 + idx;
      if (focusedWindow === name) return 2000;
      const win = windows.find(w => w.name === name);
      if (win?.dialog) return baseZ + 50;
      return baseZ;
    },
    [focusedWindow, windows],
  );

  const handleRestore = useCallback(
    (name: string) => {
      setMinimized((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
      focusWindow(name);
    },
    [focusWindow],
  );

  const handleKill = useCallback((name: string) => {
    window.compositor?.action('close' as never, { window: name });
    setMinimized((prev) => {
      const n = { ...prev };
      delete n[name];
      return n;
    });
  }, []);

  const handleAltTabSelect = useCallback(
    (windowName: string) => {
      handleRestore(windowName);
      focusWindow(windowName);
      setAltTabOpen(false);
    },
    [handleRestore, focusWindow],
  );

  const handleMinimize = useCallback(
    (name: string) => {
      setMinimized((prev) => ({ ...prev, [name]: true }));
      minimizeWindow(name);
    },
    [minimizeWindow],
  );

  const handleClose = useCallback(
    (name: string) => {
      setClosing((prev) => ({ ...prev, [name]: true }));
      
      setTimeout(() => {
        closeWindow(name);
        setMinimized((prev) => {
          const n = { ...prev };
          delete n[name];
          return n;
        });
        setClosing((prev) => {
          const n = { ...prev };
          delete n[name];
          return n;
        });
      }, 250);
    },
    [closeWindow],
  );

  const handleLaunch = useCallback(async (command: string) => {
    try {
      await window.compositor?.syscall("launch", { command });
    } catch {
      try {
        await window.compositor?.syscall("exec", { command });
      } catch {
        /* ignore */
      }
    }
  }, []);

  return (
    <div className="wo-shell">
      <div className="wo-wallpaper" />

      <Panel
        focusedAppName={focusedAppName}
        onLauncherToggle={() => setLauncherOpen((v) => !v)}
        onPowerAction={handlePowerAction}
        onNotificationToggle={handleNotificationToggle}
        notificationCount={unreadNotifications}
        trayIcons={trayIcons}
      />
      
      <div className="wo-desktop">
        {sortedWindows.map((win, idx) => (
          <MacWindow
            key={win.name}
            win={win}
            isFocused={focusedWindow === win.name}
            isClosing={closing[win.name] === true}
            zIndex={zOf(win.name, idx)}
            onFocus={() => focusWindow(win.name)}
            onClose={() => handleClose(win.name)}
            onMinimize={() => handleMinimize(win.name)}
            onMaximize={() => maximizeWindow(win.name)}
            onResize={(w, h) => resizeWindow(win.name, w, h)}
            onMove={(x, y) => moveWindow(win.name, x, y)}
          />
        ))}
      </div>

      <Dock minimizedWindows={minimizedWindows} onRestore={handleRestore} onKill={handleKill} />

      <AppLauncher
        isOpen={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        onLaunch={handleLaunch}
      />

      <NotificationToast notifications={toasts} onDismiss={dismissToast} />

      <NotificationCenter
        isOpen={notificationCenterOpen}
        onClose={handleNotificationCenterClose}
        notifications={notifications}
        onClearAll={clearAllNotifications}
        onDismiss={dismissNotification}
      />

      <AltTab
        isOpen={altTabOpen}
        windows={windows}
        focusedWindow={focusedWindow}
        onSelect={handleAltTabSelect}
        onClose={() => setAltTabOpen(false)}
      />

      {screenShareRequest && (
        <ScreenShareDialog
          appName={screenShareRequest.appName}
          windows={windows}
          onAllow={(type, windowName) => handleScreenShareResponse(true, type, windowName)}
          onDeny={() => handleScreenShareResponse(false)}
        />
      )}
    </div>
  );
}

export default App;
