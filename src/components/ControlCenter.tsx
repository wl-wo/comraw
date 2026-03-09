import { useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';

interface ControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ControlCenter({ isOpen, onClose }: ControlCenterProps) {
  const [wifiEnabled, setWifiEnabled] = useState(true);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [dndEnabled, setDndEnabled] = useState(false);
  const [brightness, setBrightness] = useState(75);
  const [volume, setVolume] = useState(50);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // delay to avoid closing immediately from the click that opened it
    const timeout = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, onClose]);

  const ToggleTile = useCallback(
    ({ icon, label, active, onToggle }: { icon: string; label: string; active: boolean; onToggle: () => void }) => (
      <button className={`cc-tile ${active ? 'cc-tile-active' : ''}`} onClick={onToggle}>
        <Icon icon={icon} width={20} height={20} />
        <span className="cc-tile-label">{label}</span>
      </button>
    ),
    [],
  );

  if (!isOpen) return null;

  return (
    <div className="control-center" ref={panelRef}>
      <div className="cc-grid">
        <ToggleTile icon="mdi:wifi" label="Wi-Fi" active={wifiEnabled} onToggle={() => setWifiEnabled((v) => !v)} />
        <ToggleTile icon="mdi:bluetooth" label="Bluetooth" active={bluetoothEnabled} onToggle={() => setBluetoothEnabled((v) => !v)} />
        <ToggleTile icon="mdi:moon-waning-crescent" label="Do Not Disturb" active={dndEnabled} onToggle={() => setDndEnabled((v) => !v)} />
      </div>

      <div className="cc-slider-group">
        <div className="cc-slider-row">
          <Icon icon="mdi:brightness-5" width={16} height={16} />
          <input
            type="range"
            min={0}
            max={100}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="cc-slider"
          />
        </div>
        <div className="cc-slider-row">
          <Icon icon="mdi:volume-high" width={16} height={16} />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="cc-slider"
          />
        </div>
      </div>
    </div>
  );
}
