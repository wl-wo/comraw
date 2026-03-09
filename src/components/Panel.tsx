import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import { SystemTray, type TrayIcon } from './SystemTray';
import { Calendar } from './Calendar';
import { WifiMenu } from './WifiMenu';
import { VolumeMenu } from './VolumeMenu';
import { ClipboardMenu } from './ClipboardMenu';

interface PanelProps {
  focusedAppName?: string;
  onLauncherToggle: () => void;
  onPowerAction: (action: 'lock' | 'sleep' | 'restart' | 'shutdown' | 'logout') => void;
  onNotificationToggle: () => void;
  notificationCount?: number;
  trayIcons?: TrayIcon[];
}

function useClock() {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date) {
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

interface BatteryInfo { level: number; charging: boolean }

function useBattery(): BatteryInfo | null {
  const [info, setInfo] = useState<BatteryInfo | null>(null);
  useEffect(() => {
    const nav = navigator as any;
    if (!nav.getBattery) return;
    let batRef: any;
    nav.getBattery().then((b: any) => {
      batRef = b;
      const update = () => setInfo({ level: b.level, charging: b.charging });
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
    }).catch(() => {});
    return () => {
      if (batRef) {
        const noop = () => {};
        batRef.removeEventListener('levelchange', noop);
        batRef.removeEventListener('chargingchange', noop);
      }
    };
  }, []);
  return info;
}

function batteryIcon(level: number, charging: boolean): string {
  if (charging) return 'mdi:battery-charging';
  if (level > 0.90) return 'mdi:battery';
  if (level > 0.80) return 'mdi:battery-90';
  if (level > 0.70) return 'mdi:battery-80';
  if (level > 0.60) return 'mdi:battery-70';
  if (level > 0.50) return 'mdi:battery-60';
  if (level > 0.40) return 'mdi:battery-50';
  if (level > 0.30) return 'mdi:battery-40';
  if (level > 0.20) return 'mdi:battery-30';
  if (level > 0.10) return 'mdi:battery-20';
  return 'mdi:battery-alert';
}

function batteryColor(level: number, charging: boolean): string {
  if (charging) return 'var(--max)';
  if (level > 0.20) return 'inherit';
  return '#FF5F57';
}

const POWER_ITEMS = [
  { label: 'Lock',     icon: 'mdi:lock-outline',    action: 'lock'     },
  { label: 'Suspend',  icon: 'mdi:power-sleep',      action: 'sleep'    },
  { label: 'Log Out',  icon: 'mdi:logout',           action: 'logout'   },
  { label: 'Restart',  icon: 'mdi:restart',          action: 'restart'  },
  { label: 'Shut Down',icon: 'mdi:power',            action: 'shutdown' },
 ] as const;

function PowerMenu({ onPowerAction }: { onPowerAction: (action: 'lock' | 'sleep' | 'restart' | 'shutdown' | 'logout') => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handle = useCallback((action: 'lock' | 'sleep' | 'restart' | 'shutdown' | 'logout') => {
    setOpen(false);
    onPowerAction(action);
  }, [onPowerAction]);

  return (
    <div className="wo-panel-menu-anchor" ref={ref}>
      <button
        className="wo-panel-icon-btn"
        aria-label="Power"
        onClick={() => setOpen(v => !v)}
      >
        <Icon icon="mdi:power" width={15} height={15} />
      </button>
      {open && (
        <div className="wo-panel-dropdown wo-panel-dropdown-right">
          {POWER_ITEMS.map(item => (
            <button
              key={item.action}
              className="wo-panel-dropdown-item"
              onClick={() => handle(item.action)}
            >
              <Icon icon={item.icon} width={14} height={14} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const Panel = memo(function Panel({
  focusedAppName,
  onLauncherToggle,
  onPowerAction,
  onNotificationToggle,
  notificationCount = 0,
  trayIcons = [],
}: PanelProps) {
  const time = useClock();
  const date = formatDate(new Date());
  const battery = useBattery();
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCalendar) return;
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalendar]);

  return (
    <div className="wo-panel">
      <div className="wo-panel-left">
        <button
          className="wo-panel-apps-btn"
          onClick={onLauncherToggle}
          aria-label="Open app launcher"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3"  cy="3"  r="1.5" />
            <circle cx="8"  cy="3"  r="1.5" />
            <circle cx="13" cy="3"  r="1.5" />
            <circle cx="3"  cy="8"  r="1.5" />
            <circle cx="8"  cy="8"  r="1.5" />
            <circle cx="13" cy="8"  r="1.5" />
            <circle cx="3"  cy="13" r="1.5" />
            <circle cx="8"  cy="13" r="1.5" />
            <circle cx="13" cy="13" r="1.5" />
          </svg>
        </button>

        {focusedAppName && (
          <span className="wo-panel-app-name">{focusedAppName}</span>
        )}
      </div>

      <div className="wo-panel-centre" ref={calendarRef}>
        <button
          className="wo-panel-datetime-btn"
          onClick={() => setShowCalendar(v => !v)}
          aria-label="Show calendar"
        >
          <span className="wo-panel-date">{date}</span>
          <span className="wo-panel-clock">{time}</span>
        </button>
        {showCalendar && <Calendar />}
      </div>

      <div className="wo-panel-right">
        <SystemTray icons={trayIcons} />
        
        <ClipboardMenu />
        
        <VolumeMenu />
        
        <WifiMenu />
        
        {battery && (
          <div
            className="wo-panel-battery"
            title={`${Math.round(battery.level * 100)}%${battery.charging ? ' · Charging' : ''}`}
            style={{ color: batteryColor(battery.level, battery.charging) }}
          >
            <Icon icon={batteryIcon(battery.level, battery.charging)} width={16} height={16} />
            <span className="wo-panel-battery-pct">
              {Math.round(battery.level * 100)}%
            </span>
          </div>
        )}

        <button
          className="wo-panel-notif-badge"
          onClick={onNotificationToggle}
          aria-label="Toggle notifications"
          title="Notifications"
        >
            <Icon icon="mdi:bell-outline" width={14} height={14} />
            {notificationCount > 0 && (
              <span className="wo-panel-notif-count">{notificationCount}</span>
            )}
        </button>

        <PowerMenu onPowerAction={onPowerAction} />
      </div>
    </div>
  );
});
