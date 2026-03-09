import { memo, useState, useEffect, useCallback, useRef } from 'react';
import type { ApplicationInfo } from 'wo-types';
import { Icon } from '@iconify/react';

/** Map common freedesktop icon names to iconify IDs */
const ICON_MAP: Record<string, string> = {
  firefox: 'mdi:firefox', 'org.mozilla.firefox': 'mdi:firefox',
  chromium: 'mdi:google-chrome', 'google-chrome': 'mdi:google-chrome',
  'org.gnome.terminal': 'mdi:console', terminal: 'mdi:console',
  kitty: 'mdi:console', alacritty: 'mdi:console', 'org.kde.konsole': 'mdi:console',
  nautilus: 'mdi:folder', 'org.gnome.nautilus': 'mdi:folder', thunar: 'mdi:folder',
  code: 'mdi:microsoft-visual-studio-code', 'visual-studio-code': 'mdi:microsoft-visual-studio-code',
  'org.gnome.settings': 'mdi:cog', 'org.gnome.tweaks': 'mdi:tune',
  steam: 'mdi:steam', discord: 'mdi:discord', spotify: 'mdi:spotify',
  gimp: 'mdi:image-edit', inkscape: 'mdi:draw', blender: 'mdi:cube-outline',
  vlc: 'mdi:vlc', mpv: 'mdi:play-circle', 'org.gnome.totem': 'mdi:play-circle',
  thunderbird: 'mdi:email', evolution: 'mdi:email',
  libreoffice: 'mdi:file-document', 'org.libreoffice.libreoffice': 'mdi:file-document',
  gedit: 'mdi:file-document-edit', 'org.gnome.gedit': 'mdi:file-document-edit',
  'org.gnome.calculator': 'mdi:calculator', 'org.gnome.clocks': 'mdi:clock-outline',
  'org.gnome.eog': 'mdi:image', 'org.gnome.evince': 'mdi:file-pdf-box',
  transmission: 'mdi:download', qbittorrent: 'mdi:download',
};

function resolveIconId(icon?: { type: string; data: string }): string {
  if (!icon) return 'mdi:application';
  if (icon.type === 'base64') return ''; // handled separately
  const data = icon.data;
  // Already a valid iconify ID (contains ':')
  if (data.includes(':')) return data;
  // Try mapping from freedesktop icon name
  const lower = data.toLowerCase();
  return ICON_MAP[lower] || 'mdi:application';
}

interface AppLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: (command: string) => void;
}

export const AppLauncher = memo(function AppLauncher({
  isOpen,
  onClose,
  onLaunch,
}: AppLauncherProps) {
  const [apps, setApps] = useState<ApplicationInfo[]>([]);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load apps on first open
  useEffect(() => {
    if (!isOpen || apps.length > 0) return;
    window.compositor?.syscall('list_applications', {})
      .then((result: unknown) => {
        if (Array.isArray(result)) setApps(result as ApplicationInfo[]);
      })
      .catch(() => {});
  }, [isOpen, apps.length]);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);

    let onDown: ((e: MouseEvent) => void) | null = null;
    const timer = setTimeout(() => {
      onDown = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose();
      };
      document.addEventListener('mousedown', onDown);
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(timer);
      if (onDown) document.removeEventListener('mousedown', onDown);
    };
  }, [isOpen, onClose]);

  const handleLaunch = useCallback((app: ApplicationInfo) => {
    onLaunch(app.command);
    onClose();
  }, [onLaunch, onClose]);

  if (!isOpen) return null;

  const filtered = apps.filter(
    (a) => !query || a.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="wo-launcher" ref={ref}>
      <div className="wo-launcher-search-row">
        <Icon icon="mdi:magnify" className="wo-launcher-search-icon" width={14} height={14} />
        <input
          ref={inputRef}
          className="wo-launcher-search"
          type="text"
          placeholder="Search applications..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="wo-launcher-list">
        {filtered.map((app) => {
          const iconId = resolveIconId(app.icon);
          return (
            <button
              key={app.name}
              className="wo-launcher-item"
              onClick={() => handleLaunch(app)}
            >
              <span className="wo-launcher-icon">
                {app.icon?.type === 'base64' ? (
                  <img src={`data:${app.icon.mimeType || 'image/png'};base64,${app.icon.data}`} width={20} height={20} alt="" />
                ) : (
                  <Icon icon={iconId} width={20} height={20} />
                )}
              </span>
              <span className="wo-launcher-label">{app.name}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="wo-launcher-empty">No applications found</p>
        )}
      </div>
    </div>
  );
});
