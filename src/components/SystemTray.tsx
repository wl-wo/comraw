import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react';

interface TrayMenuItem {
  id: string;
  label: string;
  icon?: string;
  enabled?: boolean;
  checkmark?: boolean;
  onClick?: () => void;
}

export interface TrayIcon {
  id: string;
  icon: string;
  title: string;
  status?: 'active' | 'passive' | 'attention';
  onClick?: () => void;
  onContextMenu?: () => void;
  menu?: TrayMenuItem[];
}

interface SystemTrayProps {
  icons?: TrayIcon[];
}

export function SystemTray({ icons = [] }: SystemTrayProps) {
  const [trayIcons, setTrayIcons] = useState<TrayIcon[]>(icons);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTrayIcons(icons);
  }, [icons]);

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  const handleIconClick = useCallback((icon: TrayIcon) => {
    if (icon.onClick) {
      icon.onClick();
      return;
    }
    if (icon.menu && icon.menu.length > 0) {
      setOpenMenu(openMenu === icon.id ? null : icon.id);
    }
  }, [openMenu]);

  const handleIconContextMenu = useCallback((event: React.MouseEvent, icon: TrayIcon) => {
    event.preventDefault();
    icon.onContextMenu?.();
    if (icon.menu && icon.menu.length > 0) {
      setOpenMenu(openMenu === icon.id ? null : icon.id);
    }
  }, [openMenu]);

  const handleMenuItemClick = useCallback((item: TrayMenuItem) => {
    if (item.enabled !== false && item.onClick) {
      item.onClick();
      setOpenMenu(null);
    }
  }, []);

  if (trayIcons.length === 0) {
    return null;
  }

  return (
    <div className="system-tray" ref={menuRef}>
      {trayIcons.map((icon) => (
        <div
          key={icon.id}
          className="system-tray-icon-wrapper"
        >
          <button
            className={`system-tray-icon ${icon.status === 'attention' ? 'system-tray-icon-attention' : ''}`}
            title={icon.title}
            onClick={() => handleIconClick(icon)}
            onContextMenu={(event) => handleIconContextMenu(event, icon)}
          >
            {icon.icon.startsWith('data:image/') ? (
              <img src={icon.icon} alt={icon.title} width={16} height={16} className="system-tray-icon-image" />
            ) : (
              <Icon icon={icon.icon} width={16} height={16} />
            )}
          </button>
          {openMenu === icon.id && icon.menu && (
            <div className="system-tray-menu">
              {icon.menu.map((item) => (
                <button
                  key={item.id}
                  className={`system-tray-menu-item ${item.enabled === false ? 'disabled' : ''}`}
                  onClick={() => handleMenuItemClick(item)}
                  disabled={item.enabled === false}
                >
                  {item.icon && <Icon icon={item.icon} width={14} height={14} />}
                  <span>{item.label}</span>
                  {item.checkmark && <Icon icon="mdi:check" width={14} height={14} className="checkmark" />}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
