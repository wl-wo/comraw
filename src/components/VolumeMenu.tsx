import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import './VolumeMenu.css';

export const VolumeMenu = memo(function VolumeMenu() {
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(50);
  const [muted, setMuted] = useState(false);
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
    const fetchVolume = async () => {
      try {
        const result = await window.compositor?.syscall('exec', {
          command: 'pactl',
          args: ['get-sink-volume', '@DEFAULT_SINK@'],
          capture_output: true,
        });

        if (result?.success && result?.stdout) {
          const match = result.stdout.match(/(\d+)%/);
          if (match) {
            setVolume(Number(match[1]));
          }
        }
      } catch (err) {
        console.error('Failed to get volume:', err);
      }
    };

    const fetchMuteStatus = async () => {
      try {
        const result = await window.compositor?.syscall('exec', {
          command: 'pactl',
          args: ['get-sink-mute', '@DEFAULT_SINK@'],
          capture_output: true,
        });

        if (result?.success && result?.stdout) {
          setMuted(result.stdout.trim().includes('yes'));
        }
      } catch (err) {
        console.error('Failed to get mute status:', err);
      }
    };

    fetchVolume();
    fetchMuteStatus();
  }, [open]);

  const handleVolumeChange = useCallback(async (newVolume: number) => {
    setVolume(newVolume);
    try {
      await window.compositor?.syscall('exec', {
        command: 'pactl',
        args: ['set-sink-volume', '@DEFAULT_SINK@', `${newVolume}%`],
        capture_output: false,
      });
    } catch (err) {
      console.error('Failed to set volume:', err);
    }
  }, []);

  const toggleMute = useCallback(async () => {
    const newMuted = !muted;
    setMuted(newMuted);
    try {
      await window.compositor?.syscall('exec', {
        command: 'pactl',
        args: ['set-sink-mute', '@DEFAULT_SINK@', newMuted ? '1' : '0'],
        capture_output: false,
      });
    } catch (err) {
      console.error('Failed to toggle mute:', err);
    }
  }, [muted]);

  const getVolumeIcon = () => {
    if (muted) return 'mdi:volume-mute';
    if (volume === 0) return 'mdi:volume-off';
    if (volume < 33) return 'mdi:volume-low';
    if (volume < 66) return 'mdi:volume-medium';
    return 'mdi:volume-high';
  };

  return (
    <div className="wo-panel-menu-anchor" ref={ref}>
      <button
        className="wo-panel-icon-btn"
        aria-label="Volume"
        onClick={() => setOpen(v => !v)}
      >
        <Icon icon={getVolumeIcon()} width={15} height={15} />
      </button>
      {open && (
        <div className="wo-panel-dropdown wo-panel-dropdown-right volume-menu">
          <div className="volume-menu-header">
            <span className="volume-menu-title">Volume</span>
            <button
              className="volume-mute-btn"
              onClick={toggleMute}
              title={muted ? 'Unmute' : 'Mute'}
            >
              <Icon 
                icon={muted ? 'mdi:volume-mute' : 'mdi:volume-high'} 
                width={20} 
                height={20}
              />
            </button>
          </div>

          <div className="volume-slider-container">
            <Icon icon="mdi:volume-low" width={16} height={16} className="volume-icon-start" />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="volume-slider"
            />
            <Icon icon="mdi:volume-high" width={16} height={16} className="volume-icon-end" />
          </div>

          <div className="volume-percentage">{volume}%</div>
        </div>
      )}
    </div>
  );
});
