import { memo, useState, useCallback, useRef, useEffect } from 'react';
import './Dock.css';
import type { CompositorWindow } from '../hooks/useWindowManager';
import { getIconUrl } from '../utils/iconUtils';
import { Icon } from '@iconify/react';

interface DockProps {
  minimizedWindows: CompositorWindow[];
  onRestore: (name: string) => void;
  onKill?: (name: string) => void;
}

interface ContextMenuState {
  windowName: string;
  x: number;
  y: number;
}

const APP_ICONS: Record<string, string> = {
  'org.gnome.Terminal': 'mdi:terminal',
  'kitty': 'mdi:application-brackets',
  'alacritty': 'mdi:application-brackets',
  'foot': 'mdi:application-brackets-outline',
  
  'firefox': 'mdi:firefox',
  'chromium': 'mdi:google-chrome',
  'google-chrome': 'mdi:google-chrome',
  'brave-browser': 'simple-icons:brave',
  'Microsoft-edge': 'mdi:microsoft-edge',
  
  'code': 'mdi:microsoft-visual-studio-code',
  'code-oss': 'mdi:microsoft-visual-studio-code',
  'sublime_text': 'mdi:file-document-edit',
  'gedit': 'mdi:text-box',
  'org.gnome.gedit': 'mdi:text-box',
  
  'org.gnome.Nautilus': 'mdi:folder',
  'org.freedesktop.Thunar': 'mdi:folder-open',
  'dolphin': 'mdi:dolphin',
  
  'steam': 'mdi:steam',
  'celeste': 'mdi:gamepad-variant',
  'minecraft': 'mdi:minecraft',
  
  'vlc': 'mdi:vlc',
  'mpv': 'mdi:play-circle',
  'spotify': 'mdi:spotify',
  
  'slack': 'mdi:slack',
  'discord': 'simple-icons:discord',
  'telegram': 'mdi:telegram',
  
  'org.gnome.Settings': 'mdi:cog',
  'systemsettings': 'mdi:cog',
};

function getWindowIcon(win: CompositorWindow): string {
  if (win.app_id && APP_ICONS[win.app_id]) {
    return APP_ICONS[win.app_id];
  }
  
  if (win.app_id) {
    const lowerAppId = win.app_id.toLowerCase();
    if (APP_ICONS[lowerAppId]) {
      return APP_ICONS[lowerAppId];
    }
    
    if (lowerAppId.includes('terminal')) return 'mdi:terminal';
    if (lowerAppId.includes('browser') || lowerAppId.includes('chrome')) return 'mdi:web';
    if (lowerAppId.includes('editor') || lowerAppId.includes('code')) return 'mdi:file-code';
    if (lowerAppId.includes('file') || lowerAppId.includes('folder')) return 'mdi:folder';
  }
  
  // Try title-based matching as fallback
  if (win.title) {
    const lowerTitle = win.title.toLowerCase();
    if (lowerTitle.includes('terminal')) return 'mdi:terminal';
    if (lowerTitle.includes('firefox')) return 'mdi:firefox';
    if (lowerTitle.includes('chrome')) return 'mdi:google-chrome';
    if (lowerTitle.includes('code') || lowerTitle.includes('vscode')) return 'mdi:microsoft-visual-studio-code';
  }
  
  // Source-based icons
  if (win.source === 'x11') return 'mdi:application-brackets'; // XWayland apps
  if (win.source === 'electron') return 'mdi:electron-framework';
  
  return 'mdi:application';
}

export const Dock = memo(function Dock({ minimizedWindows, onRestore, onKill }: DockProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [hoveredWindow, setHoveredWindow] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (minimizedWindows.length > 0) {
      console.log('Dock windows:', minimizedWindows.map(w => ({
        name: w.name,
        title: w.title,
        app_id: w.app_id,
        source: w.source,
        icon: getWindowIcon(w)
      })));
    }
  }, [minimizedWindows]);

  useEffect(() => {
    if (!contextMenu) return;


    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, windowName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      windowName,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const handleRestore = useCallback((name: string) => {
    setContextMenu(null);
    onRestore(name);
  }, [onRestore]);

  const handleKill = useCallback((name: string) => {
    setContextMenu(null);
    if (onKill) {
      onKill(name);
    }
  }, [onKill]);

  if (minimizedWindows.length === 0) return null;

  return (
    <div className="dock">
      <div className="dock-container">
        {minimizedWindows.map((win) => {
          const iconName = getWindowIcon(win);
          const iconUrl = getIconUrl({ type: 'iconify', data: iconName });
          const isHovered = hoveredWindow === win.name;
          
          return (
            <div key={win.name} className="dock-item-wrapper">
              <button
                className="dock-item"
                onClick={() => onRestore(win.name)}
                onContextMenu={(e) => handleContextMenu(e, win.name)}
                onMouseEnter={() => setHoveredWindow(win.name)}
                onMouseLeave={() => setHoveredWindow(null)}
                aria-label={win.title || win.app_id || win.name}
              >
                {iconUrl.type === 'iconify' ? (
                  <div className="dock-item-icon">
                    <Icon icon={iconUrl.value} width="32" height="32" />
                  </div>
                ) : iconUrl.type === 'data-url' || iconUrl.type === 'url' ? (
                  <div className="dock-item-icon">
                    <img src={iconUrl.value} alt="" width="32" height="32" />
                  </div>
                ) : (
                  <div className="dock-item-icon">
                    <Icon icon="mdi:application" width="32" height="32" />
                  </div>
                )}
              </button>
              {isHovered && (
                <div className="dock-tooltip">
                  {win.title || win.app_id || win.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="dock-context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            className="dock-context-menu-item"
            onClick={() => handleRestore(contextMenu.windowName)}
          >
            <Icon icon="mdi:window-restore" width="16" height="16"></Icon>
            <span>Restore</span>
          </button>
          {onKill && (
            <button
              className="dock-context-menu-item dock-context-menu-item-danger"
              onClick={() => handleKill(contextMenu.windowName)}
            >
              <Icon icon="mdi:close-circle" width="16" height="16"></Icon>
              <span>End Task</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});