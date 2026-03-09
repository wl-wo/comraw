import { useEffect, useState, useCallback } from "react";
import { Icon } from "@iconify/react";
import type { ApplicationInfo } from "@wl-wo/wo-types";
import { getIconUrl } from "../utils/iconUtils";
import "./AppBrowser.css";

interface AppBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchApplication: (appName: string) => void;
}

/**
 * Full application browser - shows all installed apps
 */
export function AppBrowser({
  isOpen,
  onClose,
  onLaunchApplication,
}: AppBrowserProps) {
  const [apps, setApps] = useState<ApplicationInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Load all applications on first open
  useEffect(() => {
    if (!isOpen) return;

    const loadApps = async () => {
      if (apps.length > 0) return; // Already loaded

      setLoading(true);
      try {
        if (window.compositor?.syscall) {
          const result = await window.compositor.syscall(
            "list_applications",
            {}
          );
          if (Array.isArray(result)) {
            setApps(result);
          }
        }
      } catch (error) {
        console.error("[AppBrowser] Failed to load applications:", error);
      } finally {
        setLoading(false);
      }
    };

    loadApps();
  }, [isOpen, apps.length]);

  const handleLaunch = useCallback(
    (appName: string) => {
      onLaunchApplication(appName);
      // Close after a short delay to show the action
      setTimeout(onClose, 300);
    },
    [onLaunchApplication, onClose]
  );

  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderAppIcon = (app: ApplicationInfo) => {
    const icon = getIconUrl(app.icon);

    switch (icon.type) {
      case "iconify":
        return (
          <Icon
            icon={icon.value}
            width={32}
            height={32}
            className="app-browser-icon-iconify"
          />
        );
      case "data-url":
      case "url":
        return (
          <img
            src={icon.value}
            alt={app.name}
            className="app-browser-icon-img"
            loading="lazy"
          />
        );
      case "fallback":
        return (
          <Icon
            icon={icon.value}
            width={32}
            height={32}
            className="app-browser-icon-iconify"
          />
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="app-browser-overlay" onClick={onClose}>
      <div className="app-browser-modal" onClick={(e) => e.stopPropagation()}>
        <div className="app-browser-search">
          <Icon icon="mdi:magnify" width={20} height={20} />
          <input
            type="text"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="app-browser-content">
          {loading ? (
            <div className="app-browser-loading">Loading applications...</div>
          ) : filteredApps.length === 0 ? (
            <div className="app-browser-empty">
              {apps.length === 0
                ? "No applications found"
                : "No applications match your search"}
            </div>
          ) : (
            <div className="app-browser-grid">
              {filteredApps.map((app) => (
                <button
                  key={app.name}
                  className="app-browser-item"
                  onClick={() => handleLaunch(app.name)}
                >
                  <div className="app-browser-item-icon">
                    {renderAppIcon(app)}
                  </div>
                  <span className="app-browser-item-name">{app.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
