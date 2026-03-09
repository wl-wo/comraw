import { useEffect, useState, useCallback, useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { ApplicationIcon, WoWindow } from '@wl-wo/wo-types';
import { getIconUrl } from '../utils/iconUtils';
import './AltTab.css';

interface AltTabProps {
  isOpen: boolean;
  windows: WoWindow[];
  focusedWindow: string | null;
  onSelect: (windowName: string) => void;
  onClose: () => void;
}

/**
 * Alt-Tab window switcher overlay
 * Shows all windows and allows keyboard navigation
 */
export function AltTab({
  isOpen,
  windows,
  focusedWindow,
  onSelect,
  onClose,
}: AltTabProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter out the root 'main' window and sort by recent focus
  const switchableWindows = useMemo(() => {
    const filtered = windows.filter((w) => w.name !== 'main' && w.mapped !== false);
    // Put currently focused window first
    const sorted = [...filtered].sort((a, b) => {
      if (a.name === focusedWindow) return -1;
      if (b.name === focusedWindow) return 1;
      return 0;
    });
    return sorted;
  }, [windows, focusedWindow]);

  // Reset selection when windows change
  useEffect(() => {
    if (isOpen && switchableWindows.length > 0) {
      // Start at index 1 (next window) if there are multiple windows
      setSelectedIndex(switchableWindows.length > 1 ? 1 : 0);
    }
  }, [isOpen, switchableWindows.length]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab: go backwards
          setSelectedIndex((prev) => 
            prev === 0 ? switchableWindows.length - 1 : prev - 1
          );
        } else {
          // Tab: go forwards
          setSelectedIndex((prev) => 
            prev === switchableWindows.length - 1 ? 0 : prev + 1
          );
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (switchableWindows[selectedIndex]) {
          onSelect(switchableWindows[selectedIndex].name);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev === 0 ? switchableWindows.length - 1 : prev - 1
        );
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev === switchableWindows.length - 1 ? 0 : prev + 1
        );
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, switchableWindows, onSelect, onClose]);

  const renderWindowIcon = useCallback((win: WoWindow) => {
    // Try to get icon from app_id or name
    const iconName = win.app_id || win.name;
    
    const iconData: ApplicationIcon = {
      type: 'iconify',
      data: iconName.toLowerCase().replace(/\s+/g, '-'),
    };
    
    const icon = getIconUrl(iconData);

    switch (icon.type) {
      case 'iconify':
        return (
          <Icon
            icon={icon.value}
            width={48}
            height={48}
            className="alttab-icon-iconify"
          />
        );
      case 'data-url':
      case 'url':
        return (
          <img
            src={icon.value}
            alt={win.title || win.name}
            className="alttab-icon-img"
          />
        );
      case 'fallback':
        return (
          <Icon
            icon={icon.value}
            width={48}
            height={48}
            className="alttab-icon-iconify"
          />
        );
    }
  }, []);

  if (!isOpen || switchableWindows.length === 0) return null;

  return (
    <div className="alttab-overlay">
      <div className="alttab-container">
        <div className="alttab-grid">
          {switchableWindows.map((win, idx) => {
            const isSelected = idx === selectedIndex;
            const title = win.title || win.app_id || win.name;

            return (
              <button
                key={win.name}
                className={`alttab-item${isSelected ? ' selected' : ''}`}
                onClick={() => onSelect(win.name)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="alttab-item-icon">
                  {renderWindowIcon(win)}
                </div>
                <div className="alttab-item-title">{title}</div>
                <div className="alttab-item-subtitle">
                  {win.source === 'wayland' ? 'Wayland' : win.source === 'x11' ? 'X11' : 'Electron'}
                </div>
              </button>
            );
          })}
        </div>
        <div className="alttab-hint">
          Tab / Arrow keys to navigate • Enter to select • Esc to cancel
        </div>
      </div>
    </div>
  );
}
