import { memo, useState, useCallback } from 'react';
import { Icon } from '@iconify/react';
import './ScreenShareDialog.css';
import type { CompositorWindow } from '../hooks/useWindowManager';

interface ScreenShareDialogProps {
  appName: string;
  windows: CompositorWindow[];
  onAllow: (type: 'screen' | 'window', windowName?: string) => void;
  onDeny: () => void;
}

export const ScreenShareDialog = memo(function ScreenShareDialog({
  appName,
  windows,
  onAllow,
  onDeny,
}: ScreenShareDialogProps) {
  const [selectedTab, setSelectedTab] = useState<'screen' | 'window'>('screen');
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null);

  const handleAllow = useCallback(() => {
    if (selectedTab === 'screen') {
      onAllow('screen');
    } else if (selectedWindow) {
      onAllow('window', selectedWindow);
    }
  }, [selectedTab, selectedWindow, onAllow]);

  const eligibleWindows = windows.filter(w => 
    w.name !== 'main' && 
    w.mapped !== false &&
    w.source !== 'electron'
  );

  return (
    <div className="screenshare-overlay">
      <div className="screenshare-dialog">
        <div className="screenshare-header">
          <div className="screenshare-icon">
            <Icon icon="mdi:monitor-share" width="24" height="24" />
          </div>
          <div className="screenshare-title">
            <h2>Share Your Screen</h2>
            <p className="screenshare-app-name">{appName} wants to record your screen</p>
          </div>
        </div>

        <div className="screenshare-tabs">
          <button
            className={`screenshare-tab ${selectedTab === 'screen' ? 'active' : ''}`}
            onClick={() => setSelectedTab('screen')}
          >
            <Icon icon="mdi:monitor" width="18" height="18" />
            <span>Entire Screen</span>
          </button>
          <button
            className={`screenshare-tab ${selectedTab === 'window' ? 'active' : ''}`}
            onClick={() => setSelectedTab('window')}
          >
            <Icon icon="mdi:window-maximize" width="18" height="18" />
            <span>Application Window</span>
          </button>
        </div>

        <div className="screenshare-content">
          {selectedTab === 'screen' ? (
            <div className="screenshare-option-full">
              <div className="screenshare-preview-screen">
                <Icon icon="mdi:monitor" width="48" height="48" />
                <span>Full Screen</span>
              </div>
              <p className="screenshare-description">
                Share your entire screen with audio
              </p>
            </div>
          ) : (
            <div className="screenshare-window-list">
              {eligibleWindows.length === 0 ? (
                <div className="screenshare-empty">
                  <Icon icon="mdi:window-close" width="32" height="32" />
                  <p>No windows available to share</p>
                </div>
              ) : (
                eligibleWindows.map((win) => (
                  <button
                    key={win.name}
                    className={`screenshare-window-item ${selectedWindow === win.name ? 'selected' : ''}`}
                    onClick={() => setSelectedWindow(win.name)}
                  >
                    <div className="screenshare-window-icon">
                      <Icon icon="mdi:application" width="24" height="24" />
                    </div>
                    <div className="screenshare-window-info">
                      <span className="screenshare-window-title">
                        {win.title || win.app_id || win.name}
                      </span>
                      <span className="screenshare-window-type">
                        {win.source === 'x11' ? 'X11 Application' : 'Wayland Application'}
                      </span>
                    </div>
                    {selectedWindow === win.name && (
                      <Icon icon="mdi:check-circle" width="20" height="20" className="screenshare-check" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="screenshare-footer">
          <button className="screenshare-btn screenshare-btn-cancel" onClick={onDeny}>
            Cancel
          </button>
          <button
            className="screenshare-btn screenshare-btn-allow"
            onClick={handleAllow}
            disabled={selectedTab === 'window' && !selectedWindow}
          >
            <Icon icon="mdi:share" width="18" height="18" />
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>
  );
});
