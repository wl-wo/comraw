import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';

interface MenuBarProps {
  focusedAppName?: string;
  onQuit: () => void;
  onShowControlCenter: () => void;
  onShowNotificationCenter: () => void;
  onPowerAction: (action: string) => void;
}

export function MenuBar({
  focusedAppName,
  onQuit,
  onShowControlCenter,
  onShowNotificationCenter,
  onPowerAction,
}: MenuBarProps) {
  const [clock, setClock] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = useState(false);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
        '  ' +
        now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Battery
  useEffect(() => {
    let battery: any = null;
    const update = () => {
      if (battery) {
        setBatteryLevel(Math.round(battery.level * 100));
        setBatteryCharging(battery.charging);
      }
    };
    (navigator as any).getBattery?.().then((b: any) => {
      battery = b;
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
    });
    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', update);
        battery.removeEventListener('chargingchange', update);
      }
    };
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleMenu = useCallback((id: string) => {
    setOpenMenu((prev) => (prev === id ? null : id));
  }, []);

  const handleMenuAction = useCallback((action: () => void) => {
    setOpenMenu(null);
    action();
  }, []);

  const batteryIcon = batteryCharging
    ? 'mdi:battery-charging'
    : batteryLevel !== null && batteryLevel <= 20
      ? 'mdi:battery-low'
      : 'mdi:battery';

  return (
    <div className="menu-bar" ref={menuBarRef}>
      <div className="menu-bar-left">
        <div className="menu-bar-item menu-bar-logo" onClick={() => toggleMenu('wo')}>
          <Icon icon="mdi:fire" width={16} height={16} />
          {openMenu === 'wo' && (
            <div className="menu-dropdown">
              <div className="menu-dropdown-item" onClick={() => handleMenuAction(() => onPowerAction('about'))}>
                About This Compositor
              </div>
              <div className="menu-dropdown-separator" />
              <div className="menu-dropdown-item" onClick={() => handleMenuAction(() => onPowerAction('sleep'))}>
                Sleep
              </div>
              <div className="menu-dropdown-item" onClick={() => handleMenuAction(() => onPowerAction('restart'))}>
                Restart...
              </div>
              <div className="menu-dropdown-item" onClick={() => handleMenuAction(() => onPowerAction('shutdown'))}>
                Shut Down...
              </div>
              <div className="menu-dropdown-separator" />
              <div className="menu-dropdown-item" onClick={() => handleMenuAction(() => onPowerAction('lock'))}>
                Lock Screen
              </div>
              <div className="menu-dropdown-item" onClick={() => handleMenuAction(() => onPowerAction('logout'))}>
                Log Out
              </div>
            </div>
          )}
        </div>
        
        <div className="menu-bar-item menu-bar-app-name" onClick={() => toggleMenu('app')}>
          <strong>{focusedAppName || 'Finder'}</strong>
          {openMenu === 'app' && (
            <div className="menu-dropdown">
              <div className="menu-dropdown-item" onClick={() => handleMenuAction(() => onPowerAction('about'))}>
                About {focusedAppName || 'Finder'}
              </div>
              <div className="menu-dropdown-separator" />
              <div className="menu-dropdown-item" onClick={() => handleMenuAction(onQuit)}>
                Quit {focusedAppName || 'Finder'}
              </div>
            </div>
          )}
        </div>

        {['File', 'Edit', 'View', 'Window', 'Help'].map((label) => (
          <div key={label} className="menu-bar-item" onClick={() => toggleMenu(label)}>
            {label}
            {openMenu === label && (
              <div className="menu-dropdown">
                <div className="menu-dropdown-item disabled">{label} menu</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="menu-bar-right">
        <div className="menu-bar-icon" title="Wi-Fi">
          <Icon icon="mdi:wifi" width={16} height={16} />
        </div>
        <div className="menu-bar-icon" title="Volume">
          <Icon icon="mdi:volume-high" width={16} height={16} />
        </div>
        {batteryLevel !== null && (
          <div className="menu-bar-icon" title={`Battery: ${batteryLevel}%`}>
            <Icon icon={batteryIcon} width={16} height={16} />
            <span className="menu-bar-battery-text">{batteryLevel}%</span>
          </div>
        )}
        <div className="menu-bar-icon" title="Control Center" onClick={onShowControlCenter}>
          <Icon icon="mdi:toggle-switch-outline" width={16} height={16} />
        </div>
        <div className="menu-bar-clock">{clock}</div>
        <div className="menu-bar-icon" title="Notifications" onClick={onShowNotificationCenter}>
          <Icon icon="mdi:bell-outline" width={16} height={16} />
        </div>
      </div>
    </div>
  );
}
