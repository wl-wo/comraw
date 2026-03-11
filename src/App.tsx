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
import { CaptureIndicator } from "./components/CaptureIndicator";
import { NotificationCenter } from "./components/NotificationCenter";
import {
  NotificationToast,
  type NotificationItem,
} from "./components/NotificationToast";
import type { NotificationData, PortalRequestEvent } from "@wl-wo/wo-types";

let toastIdSeq = 0;

type DBusMenuItem = {
  id: string;
  label: string;
  enabled?: boolean;
  children?: DBusMenuItem[];
};

type TrayItem = {
  id: string;
  title: string;
  status?: "active" | "passive" | "attention";
  icon?: string;
  iconDataUrl?: string;
  service: string;
  objectPath: string;
  hasMenu?: boolean;
  menuPath?: string;
};

const parseQuotedStrings = (output: string): string[] => {
  const matches = output.matchAll(/"((?:[^"\\]|\\.)*)"/g);
  const values: string[] = [];
  for (const match of matches) {
    const raw = match[1];
    values.push(raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
  return values;
};

const parseServiceAndPath = (itemRef: string): { service: string; objectPath: string } | null => {
  const slashIdx = itemRef.indexOf("/");
  if (slashIdx > 0) {
    return {
      service: itemRef.slice(0, slashIdx),
      objectPath: itemRef.slice(slashIdx),
    };
  }
  if (!itemRef) return null;
  return { service: itemRef, objectPath: "/StatusNotifierItem" };
};

const parseBusctlStringValue = (output: string): string => {
  const quoted = parseQuotedStrings(output);
  if (quoted.length > 0) return quoted[0];
  const parts = output.split(/\s+/);
  return parts.length >= 2 ? parts.slice(1).join(" ").trim() : "";
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
    unfocusAll,
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
  const [screencopyActive, setScreencopyActive] = useState(false);
  const [screencopyClientCount, setScreencopyClientCount] = useState(0);
  const [trayItems, setTrayItems] = useState<TrayItem[]>([]);
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
    const onPortalRequest = (data: PortalRequestEvent) => {
      const payload = (data as unknown as { payload?: any })?.payload ?? {};
      const type =
        typeof payload?.type === "string"
          ? payload.type
          : typeof data.kind === "string"
            ? data.kind
            : undefined;
      if (type !== "screen_share_request") {
        return;
      }
      setScreenShareRequest({
        requestId: data.requestId,
        appName: String(
          payload.appName || payload.app_id || (data as any).appName || "Application",
        ),
      });
    };

    const unsub = window.compositor?.onPortalRequest?.(onPortalRequest);
    return () => unsub?.();
  }, []);

  // Subscribe to screencopy capture events
  useEffect(() => {
    const unsub = window.compositor?.onScreencopyEvent?.((data) => {
      setScreencopyActive(data.active);
      setScreencopyClientCount(data.clientCount);
    });
    return () => unsub?.();
  }, []);

  const handleScreenShareResponse = useCallback(
    async (allowed: boolean, type?: 'screen' | 'window', windowName?: string) => {
      if (screenShareRequest) {
        await window.compositor?.syscall("portal_respond", {
          requestId: screenShareRequest.requestId,
          response: {
            allowed,
            sourceType: type === "window" ? "Window" : "Monitor",
            windowName: windowName || null,
          },
        });
        setScreenShareRequest(null);
      }
    },
    [screenShareRequest],
  );

  // True when any shell overlay is active and should own keyboard focus
  const shellUiActive = launcherOpen || altTabOpen || notificationCenterOpen;

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

    // Don't forward keys to compositor when shell UI is active
    if (shellUiActive || !focusedWindow) {
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
        return;
      }

      // Don't forward when interacting with any shell UI element
      const inShellUi = Boolean(
        target?.closest?.(
          ".wo-panel, .wo-panel-dropdown, .wo-launcher, .wo-alt-tab, .wo-dock, .wo-toast-stack, .wo-desktop-widgets, .notification-center, .wo-calendar, .wo-wifi-menu, .wo-volume-menu, .wo-clipboard-menu, [role='dialog'], [role='menu']",
        ),
      );
      if (inShellUi) return;

      const inNativeContent = Boolean(target?.closest?.(".wo-content"));

      // Only forward keys when the target is inside a native window's content
      // area or pointer lock is active. Never forward stray keys from the
      // desktop, UI controls, or other non-window elements.
      if (!inNativeContent && !document.pointerLockElement) {
        return;
      }

      const keycode = resolveEvdevKey(e);
      if (keycode === undefined) {
        if (e.code && !["Unidentified", ""].includes(e.code)) {
          console.debug("Unknown key code:", e.code, "key:", e.key);
        }
        return;
      }

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
  }, [focusedWindow, windows, altTabOpen, shellUiActive]);

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

  const activateTrayItem = useCallback(async (item: TrayItem) => {
    try {
      await window.compositor?.syscall("dbus_call", {
        service: item.service,
        objectPath: item.objectPath,
        interface: "org.kde.StatusNotifierItem",
        method: "Activate",
        signature: "ii",
        args: [0, 0],
        bus: "user",
      });
    } catch (error) {
      showToast(
        "Tray activation failed",
        error instanceof Error ? error.message : String(error),
        "mdi:alert-circle-outline",
        4000,
      );
    }
  }, [showToast]);

  const openTrayContextMenu = useCallback(async (item: TrayItem) => {
    try {
      await window.compositor?.syscall("dbus_call", {
        service: item.service,
        objectPath: item.objectPath,
        interface: "org.kde.StatusNotifierItem",
        method: "ContextMenu",
        signature: "ii",
        args: [0, 0],
        bus: "user",
      });
    } catch (error) {
      showToast(
        "Tray menu failed",
        error instanceof Error ? error.message : String(error),
        "mdi:alert-circle-outline",
        4000,
      );
    }
  }, [showToast]);

  const refreshTray = useCallback(async () => {
    try {
      const registered = await window.compositor?.syscall("dbus_get_property", {
        service: "org.kde.StatusNotifierWatcher",
        objectPath: "/StatusNotifierWatcher",
        interface: "org.kde.StatusNotifierWatcher",
        property: "RegisteredStatusNotifierItems",
        bus: "user",
      });
      if (!registered?.ok || !registered.stdout) {
        setTrayItems([]);
        setTrayMenus({});
        return;
      }
      const itemRefs = parseQuotedStrings(registered.stdout);
      const items: TrayItem[] = [];
      const menus: Record<string, DBusMenuItem[]> = {};

      for (const ref of itemRefs) {
        const svc = parseServiceAndPath(ref);
        if (!svc) continue;
        const base: TrayItem = {
          id: ref,
          title: ref,
          service: svc.service,
          objectPath: svc.objectPath,
        };

        const [idProp, titleProp, iconProp, attentionIconProp, statusProp, menuProp] =
          await Promise.all([
            window.compositor?.syscall("dbus_get_property", {
              service: svc.service,
              objectPath: svc.objectPath,
              interface: "org.kde.StatusNotifierItem",
              property: "Id",
              bus: "user",
            }),
            window.compositor?.syscall("dbus_get_property", {
              service: svc.service,
              objectPath: svc.objectPath,
              interface: "org.kde.StatusNotifierItem",
              property: "Title",
              bus: "user",
            }),
            window.compositor?.syscall("dbus_get_property", {
              service: svc.service,
              objectPath: svc.objectPath,
              interface: "org.kde.StatusNotifierItem",
              property: "IconName",
              bus: "user",
            }),
            window.compositor?.syscall("dbus_get_property", {
              service: svc.service,
              objectPath: svc.objectPath,
              interface: "org.kde.StatusNotifierItem",
              property: "AttentionIconName",
              bus: "user",
            }),
            window.compositor?.syscall("dbus_get_property", {
              service: svc.service,
              objectPath: svc.objectPath,
              interface: "org.kde.StatusNotifierItem",
              property: "Status",
              bus: "user",
            }),
            window.compositor?.syscall("dbus_get_property", {
              service: svc.service,
              objectPath: svc.objectPath,
              interface: "org.kde.StatusNotifierItem",
              property: "Menu",
              bus: "user",
            }),
          ]);

        const id = idProp?.stdout ? parseBusctlStringValue(idProp.stdout) : base.id;
        const title = titleProp?.stdout ? parseBusctlStringValue(titleProp.stdout) : id;
        const iconName = iconProp?.stdout ? parseBusctlStringValue(iconProp.stdout) : undefined;
        const attIcon = attentionIconProp?.stdout ? parseBusctlStringValue(attentionIconProp.stdout) : undefined;
        const status = statusProp?.stdout ? parseBusctlStringValue(statusProp.stdout).toLowerCase() as TrayItem["status"] : undefined;
        const menuPath = menuProp?.stdout ? parseBusctlStringValue(menuProp.stdout) : undefined;

        const icon = attIcon || iconName;

        items.push({
          ...base,
          id,
          title: title || id,
          icon,
          status,
          menuPath,
          hasMenu: Boolean(menuPath && menuPath !== "/"),
        });
        if (menuPath && menuPath !== "/") {
          menus[id] = menus[id] || [];
        }
      }

      setTrayItems(items);
      setTrayMenus(menus);
    } catch (error) {
      showToast(
        "Tray refresh failed",
        error instanceof Error ? error.message : String(error),
        "mdi:alert-circle-outline",
        4000,
      );
    }
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refreshTray();
    };
    void tick();
    const id = setInterval(tick, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshTray]);

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

  const trayIcons: TrayIcon[] = useMemo(
    () =>
      trayItems.map((item) => ({
        id: item.id,
        icon: item.iconDataUrl || (item.icon && item.icon.includes(':') ? item.icon : 'mdi:tray'),
        title: item.title || item.id,
        status: item.status,
        onClick: () => activateTrayItem(item),
        onContextMenu: () => openTrayContextMenu(item),
        menu: trayMenus[item.id]?.map((child) => ({
          id: child.id,
          label: child.label,
          enabled: child.enabled !== false,
          onClick: () => openTrayContextMenu(item),
        })),
      })),
    [trayItems, trayMenus, activateTrayItem, openTrayContextMenu],
  );

  const focusedAppName = useMemo(() => {
    if (!focusedWindow) return undefined;
    const w = windows.find((win) => win.name === focusedWindow);
    return w?.title || w?.app_id || w?.name;
  }, [focusedWindow, windows]);

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
          (w) => {
            if (w.name === "main" || w.mapped === false) return false;
            const isMinimized = minimized[w.name];
            const parentMinimized =
              w.dialog && w.parent_name ? minimized[w.parent_name] === true : false;
            const parentMissing =
              w.dialog && w.parent_name && !windows.some((p) => p.name === w.parent_name);
            return !isMinimized && !parentMinimized && !parentMissing;
          },
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
      const win = windows.find(w => w.name === name);
      const baseZ = 100 + (win?.z_order ?? idx);
      if (focusedWindow === name) {
        // Guarantee focused window is above ALL other windows by using the
        // maximum z_order across the whole window list, not just this window's.
        const maxZ = windows.reduce(
          (mx, w) => Math.max(mx, 100 + (w.z_order ?? 0)),
          baseZ,
        );
        return maxZ + 50;
      }
      if (win?.dialog) return baseZ + 5;
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

      <CaptureIndicator active={screencopyActive} clientCount={screencopyClientCount} />
      
      <div className="wo-desktop" onMouseDown={(e) => {
        if (e.target === e.currentTarget) unfocusAll();
      }}>
        {sortedWindows.map((win, idx) => (
          <MacWindow
            key={win.name}
            win={win}
            isFocused={focusedWindow === win.name}
            isClosing={closing[win.name] === true}
            zIndex={zOf(win.name, idx)}
            shellUiActive={shellUiActive}
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
