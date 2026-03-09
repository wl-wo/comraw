import { useCallback, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import type { ApplicationInfo } from "wo-types";
import { getIconUrl } from "../utils/iconUtils";
import "./Launcher.css";

interface LauncherProps {
  applications: ApplicationInfo[];
  onLaunchApplication: (appName: string) => void;
  onShowAppBrowser: () => void;
}

const BASE_SIZE = 48;
const MAX_SCALE = 1.7;
const EFFECT_DISTANCE = 120; // px range for magnification

function computeScale(mouseX: number, iconCenterX: number): number {
  const dist = Math.abs(mouseX - iconCenterX);
  if (dist > EFFECT_DISTANCE) return 1;
  const t = 1 - dist / EFFECT_DISTANCE;
  return 1 + (MAX_SCALE - 1) * t * t; // quadratic ease
}

export function Launcher({
  applications,
  onLaunchApplication,
  onShowAppBrowser,
}: LauncherProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [mouseX, setMouseX] = useState<number | null>(null);

  const handleLaunch = useCallback(
    (appName: string) => {
      onLaunchApplication(appName);
    },
    [onLaunchApplication]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    setMouseX(e.clientX - rect.left);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMouseX(null);
  }, []);

  const renderAppIcon = (app: ApplicationInfo, scale: number) => {
    const icon = getIconUrl(app.icon);
    const iconSize = Math.round(28 * scale);

    switch (icon.type) {
      case "iconify":
      case "fallback":
        return (
          <Icon
            icon={icon.value}
            width={iconSize}
            height={iconSize}
            className="launcher-app-icon-iconify"
          />
        );

      case "data-url":
      case "url":
        return (
          <img
            src={icon.value}
            alt={app.name}
            className="launcher-app-icon-img"
            style={{ width: iconSize, height: iconSize }}
            loading="lazy"
          />
        );
    }
  };

  if (applications.length === 0) {
    return null;
  }

  const gap = 2;
  const padding = 8;

  return (
    <div
      className="launcher-dock"
      role="toolbar"
      aria-label="Application Launcher"
      ref={dockRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="launcher-apps">
        {applications.map((app, i) => {
          const iconCenter = padding + i * (BASE_SIZE + gap) + BASE_SIZE / 2;
          const scale = mouseX !== null ? computeScale(mouseX, iconCenter) : 1;
          const size = BASE_SIZE * scale;
          const yOffset = (size - BASE_SIZE) / 2;

          return (
            <button
              key={app.name}
              className="launcher-app"
              title={app.name}
              onClick={() => handleLaunch(app.name)}
              aria-label={`Launch ${app.name}`}
              style={{
                width: size,
                height: size,
                transform: `translateY(-${yOffset}px)`,
                transition: mouseX !== null ? 'none' : 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <div className="launcher-app-icon-container">
                {renderAppIcon(app, scale)}
              </div>
            </button>
          );
        })}

        {/* App Browser Button */}
        {(() => {
          const i = applications.length;
          const iconCenter = padding + i * (BASE_SIZE + gap) + BASE_SIZE / 2;
          const scale = mouseX !== null ? computeScale(mouseX, iconCenter) : 1;
          const size = BASE_SIZE * scale;
          const yOffset = (size - BASE_SIZE) / 2;
          const iconSize = Math.round(28 * scale);

          return (
            <button
              className="launcher-app launcher-app-browser"
              title="Show all applications"
              onClick={onShowAppBrowser}
              aria-label="Show all applications"
              style={{
                width: size,
                height: size,
                transform: `translateY(-${yOffset}px)`,
                transition: mouseX !== null ? 'none' : 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <div className="launcher-app-icon-container">
                <Icon
                  icon="mdi:apps"
                  width={iconSize}
                  height={iconSize}
                  className="launcher-app-icon-iconify"
                />
              </div>
            </button>
          );
        })()}
      </div>
    </div>
  );
}
