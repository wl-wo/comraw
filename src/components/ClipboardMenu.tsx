import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import './ClipboardMenu.css';

interface ClipboardItem {
  id: number;
  content: string;
  timestamp: number;
}

type ExecOutputResult = {
  ok?: boolean;
  success?: boolean;
  stdout?: string;
};

export const ClipboardMenu = memo(function ClipboardMenu() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ClipboardItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    
    const loadHistory = async () => {
      try {
        const result = await window.compositor?.syscall('exec', {
          command: 'wl-paste',
          args: ['--list-types'],
          capture_output: true,
        });

        const typedResult = result as ExecOutputResult | undefined;
        if ((typedResult?.ok || typedResult?.success) && typedResult?.stdout) {
          const current = await window.compositor?.syscall('exec', {
            command: 'wl-paste',
            args: [],
            capture_output: true,
          });

          const typedCurrent = current as ExecOutputResult | undefined;
          if ((typedCurrent?.ok || typedCurrent?.success) && typedCurrent?.stdout) {
            const newItem: ClipboardItem = {
              id: Date.now(),
              content: typedCurrent.stdout.trim(),
              timestamp: Date.now(),
            };
            
            setHistory(prev => {
              const exists = prev.some(item => item.content === newItem.content);
              if (exists) return prev;
              return [newItem, ...prev.slice(0, 9)];
            });
          }
        }
      } catch (err) {
        console.error('Failed to load clipboard:', err);
      }
    };

    loadHistory();
  }, [open]);

  const copyToClipboard = useCallback(async (content: string) => {
    try {
      await window.compositor?.syscall('exec', {
        command: 'sh',
        args: ['-c', `echo -n "${content.replace(/"/g, '\\"')}" | wl-copy`],
        capture_output: false,
      });
      setOpen(false);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="wo-panel-menu-anchor" ref={ref}>
      <button
        className="wo-panel-icon-btn"
        aria-label="Clipboard"
        onClick={() => setOpen(v => !v)}
      >
        <Icon icon="mdi:content-paste" width={15} height={15} />
      </button>
      {open && (
        <div className="wo-panel-dropdown wo-panel-dropdown-right clipboard-menu">
          <div className="clipboard-menu-header">
            <span className="clipboard-menu-title">Clipboard</span>
            {history.length > 0 && (
              <button className="clipboard-clear-btn" onClick={clearHistory}>
                <Icon icon="mdi:delete-outline" width={16} height={16} />
              </button>
            )}
          </div>

          <div className="clipboard-items">
            {history.length === 0 ? (
              <div className="clipboard-empty">No clipboard history</div>
            ) : (
              history.map(item => (
                <button
                  key={item.id}
                  className="clipboard-item"
                  onClick={() => copyToClipboard(item.content)}
                >
                  <div className="clipboard-item-content">
                    {truncateText(item.content)}
                  </div>
                  <div className="clipboard-item-time">
                    {formatTimestamp(item.timestamp)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});
