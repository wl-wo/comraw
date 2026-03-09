import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import type { NotificationItem } from './NotificationToast';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onClearAll: () => void;
  onDismiss: (id: string) => void;
}

export function NotificationCenter({ isOpen, onClose, notifications, onClearAll, onDismiss }: NotificationCenterProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timeout = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="notification-center" ref={panelRef}>
      <div className="nc-header">
        <span className="nc-title">Notifications</span>
        {notifications.length > 0 && (
          <button className="nc-clear" onClick={onClearAll}>Clear All</button>
        )}
      </div>
      <div className="nc-list">
        {notifications.length === 0 ? (
          <div className="nc-empty">No Notifications</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="nc-item">
              <div className="nc-item-header">
                <Icon icon={n.icon || 'mdi:bell'} width={14} height={14} />
                <span className="nc-item-title">{n.title}</span>
                <span className="nc-item-time">{formatTime(n.timestamp)}</span>
                <button className="nc-item-close" onClick={() => onDismiss(n.id)}>
                  <Icon icon="mdi:close" width={10} height={10} />
                </button>
              </div>
              <div className="nc-item-body">{n.body}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
