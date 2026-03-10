import { memo } from 'react';
import { Icon } from '@iconify/react';
import './CaptureIndicator.css';

interface CaptureIndicatorProps {
  active: boolean;
  clientCount: number;
}

export const CaptureIndicator = memo(function CaptureIndicator({
  active,
  clientCount,
}: CaptureIndicatorProps) {
  if (!active) return null;

  return (
    <div className="capture-indicator">
      <div className="capture-indicator-dot" />
      <Icon icon="mdi:record-circle" width="14" height="14" />
      <span className="capture-indicator-text">
        Screen capture active{clientCount > 1 ? ` (${clientCount})` : ''}
      </span>
    </div>
  );
});
