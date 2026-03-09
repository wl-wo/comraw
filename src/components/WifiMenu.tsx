import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import './WifiMenu.css';

interface WifiNetwork {
  ssid: string;
  signal: number;
  security: boolean;
  connected: boolean;
}

type ExecOutputResult = {
  ok?: boolean;
  success?: boolean;
  stdout?: string;
};

export const WifiMenu = memo(function WifiMenu() {
  const [open, setOpen] = useState(false);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const scanNetworks = useCallback(async () => {
    setScanning(true);
    try {
      const result = await window.compositor?.syscall('exec', {
        command: 'nmcli',
        args: ['-m', 'multiline', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list'],
        capture_output: true,
      });
      
      const typedResult = result as ExecOutputResult | undefined;
      if ((typedResult?.ok || typedResult?.success) && typeof typedResult?.stdout === 'string') {
        const records = typedResult.stdout
          .split(/\n\s*\n/g)
          .map((block: string) => block.trim())
          .filter(Boolean);

        const parsed = records
          .map((record: string) => {
            const lines = record.split('\n');
            const map = new Map<string, string>();
            for (const line of lines) {
              const idx = line.indexOf(':');
              if (idx <= 0) continue;
              const key = line.slice(0, idx).trim();
              const value = line.slice(idx + 1).trim();
              map.set(key, value);
            }

            const ssid = map.get('SSID') ?? '';
            const signal = parseInt(map.get('SIGNAL') ?? '0', 10) || 0;
            const securityRaw = map.get('SECURITY') ?? '';
            const inUseRaw = map.get('IN-USE') ?? '';

            if (!ssid || ssid === '--') return null;

            return {
              ssid,
              signal,
              security: securityRaw.length > 0 && securityRaw !== '--',
              connected: inUseRaw.includes('*'),
            } as WifiNetwork;
          })
          .filter((network: WifiNetwork | null): network is WifiNetwork => network !== null);

        setNetworks(parsed);
      } else {
        setNetworks([]);
      }
    } catch (err) {
      console.error('Failed to scan wifi:', err);
      setNetworks([]);
    } finally {
      setScanning(false);
    }
  }, []);

  const toggleWifi = useCallback(async () => {
    try {
      const cmd = enabled ? 'off' : 'on';
      await window.compositor?.syscall('exec', {
        command: 'nmcli',
        args: ['radio', 'wifi', cmd],
      });
      setEnabled(!enabled);
    } catch (err) {
      console.error('Failed to toggle wifi:', err);
    }
  }, [enabled]);

  const connectToNetwork = useCallback(async (ssid: string) => {
    try {
      await window.compositor?.syscall('exec', {
        command: 'nmcli',
        args: ['dev', 'wifi', 'connect', ssid],
      });
      // Rescan to update connection status
      setTimeout(() => scanNetworks(), 1000);
    } catch (err) {
      console.error('Failed to connect to network:', err);
    }
  }, [scanNetworks]);

  useEffect(() => {
    if (open && enabled) {
      scanNetworks();
    }
  }, [open, enabled, scanNetworks]);

  const getSignalIcon = (signal: number) => {
    if (signal >= 75) return 'mdi:wifi-strength-4';
    if (signal >= 50) return 'mdi:wifi-strength-3';
    if (signal >= 25) return 'mdi:wifi-strength-2';
    return 'mdi:wifi-strength-1';
  };

  const isConnected = networks.some(n => n.connected);

  return (
    <div className="wo-panel-menu-anchor" ref={ref}>
      <button
        className="wo-panel-icon-btn"
        aria-label="Wi-Fi"
        onClick={() => setOpen(v => !v)}
      >
        <Icon 
          icon={!enabled ? 'mdi:wifi-off' : isConnected ? 'mdi:wifi' : 'mdi:wifi-strength-outline'} 
          width={15} 
          height={15} 
        />
      </button>
      {open && (
        <div className="wo-panel-dropdown wo-panel-dropdown-right wifi-menu">
          <div className="wifi-menu-header">
            <span className="wifi-menu-title">Wi-Fi</span>
            <button
              className="wifi-toggle-btn"
              onClick={toggleWifi}
              title={enabled ? 'Turn Off' : 'Turn On'}
            >
              <Icon 
                icon={enabled ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline'} 
                width={24} 
                height={24}
                style={{ color: enabled ? 'var(--max)' : 'var(--panel-text-dim)' }}
              />
            </button>
          </div>

          {enabled && (
            <>
              <div className="wifi-menu-scan">
                <button 
                  className="wifi-scan-btn" 
                  onClick={scanNetworks}
                  disabled={scanning}
                >
                  <Icon 
                    icon={scanning ? 'mdi:loading' : 'mdi:refresh'} 
                    width={14} 
                    height={14}
                    className={scanning ? 'wifi-scanning' : ''}
                  />
                  {scanning ? 'Scanning...' : 'Scan'}
                </button>
              </div>

              <div className="wifi-networks">
                {networks.length === 0 && !scanning && (
                  <div className="wifi-empty">No networks found</div>
                )}
                {networks.map(network => (
                  <button
                    key={network.ssid}
                    className={`wifi-network ${network.connected ? 'wifi-network-connected' : ''}`}
                    onClick={() => !network.connected && connectToNetwork(network.ssid)}
                    disabled={network.connected}
                  >
                    <Icon icon={getSignalIcon(network.signal)} width={16} height={16} />
                    <span className="wifi-network-ssid">{network.ssid}</span>
                    {network.security && (
                      <Icon icon="mdi:lock-outline" width={12} height={12} className="wifi-security-icon" />
                    )}
                    {network.connected && (
                      <Icon icon="mdi:check" width={14} height={14} className="wifi-connected-icon" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {!enabled && (
            <div className="wifi-disabled-msg">Wi-Fi is turned off</div>
          )}
        </div>
      )}
    </div>
  );
});
