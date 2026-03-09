import { useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  icon?: string;
  timeout?: number;
  timestamp: number;
}

interface NotificationToastProps {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
}

export function NotificationToast({ notifications, onDismiss }: NotificationToastProps) {
  return (
    <div className="wo-toasts">
      {notifications.slice(0, 4).map((n) => (
        <Toast key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({
  notification,
  onDismiss,
}: {
  notification: NotificationItem;
  onDismiss: (id: string) => void;
}) {
  const dismiss = useCallback(
    () => onDismiss(notification.id),
    [notification.id, onDismiss]
  );

  useEffect(() => {
    const ms = notification.timeout ?? 5000;
    if (ms <= 0) return;
    const timer = setTimeout(dismiss, ms);
    return () => clearTimeout(timer);
  }, [notification.timeout, dismiss]);

  return (
    <div className="wo-toast" onClick={dismiss} role="alert">
      <div className="wo-toast-icon">
        <Icon icon={notification.icon || 'mdi:bell-outline'} width={18} height={18} />
      </div>
      <div className="wo-toast-body">
        <div className="wo-toast-title">{notification.title}</div>
        {notification.body && (
          <div className="wo-toast-text">{notification.body}</div>
        )}
      </div>
      <button className="wo-toast-close" aria-label="Dismiss" onClick={dismiss}>
        <Icon icon="mdi:close" width={12} height={12} />
      </button>
    </div>
  );
}
