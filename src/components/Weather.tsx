import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";

interface WeatherData {
  temp: number;
  condition: string;
  icon: string;
  location: string;
  humidity?: number;
  windSpeed?: number;
}

const WEATHER_ICONS: Record<string, string> = {
  "clear": "mdi:white-balance-sunny",
  "partly-cloudy": "mdi:cloud",
  "cloudy": "mdi:cloud-outline",
  "rainy": "mdi:cloud-rain",
  "thunderstorm": "mdi:cloud-lightning",
  "snowy": "mdi:snowflake",
  "foggy": "mdi:fog",
  "windy": "mdi:weather-windy",
};

export function Weather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);

        // Step 1: Get IP-based location
        const ipRes = await fetch("https://ipapi.co/json/", {
          method: "GET",
        });
        if (!ipRes.ok) throw new Error("Failed to fetch IP location");
        const ipData = await ipRes.json();
        const { latitude, longitude, city } = ipData;

        // Step 2: Fetch weather using Open-Meteo (free, no API key needed)
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=celsius&timezone=auto`
        );
        if (!weatherRes.ok) throw new Error("Failed to fetch weather");
        const weatherData = await weatherRes.json();

        const current = weatherData.current;
        const weatherCode = current.weather_code;

        // Map weather codes to conditions
        const weatherCondition = mapWeatherCode(weatherCode);

        setWeather({
          temp: Math.round(current.temperature_2m),
          condition: weatherCondition,
          icon: WEATHER_ICONS[weatherCondition] || "mdi:cloud-question",
          location: city,
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m * 10) / 10,
        });
      } catch {
        setWeather({
          temp: 0,
          condition: "unknown",
          icon: "mdi:cloud-question",
          location: "Unknown",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Refresh weather every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="wo-weather-widget">
        <Icon icon="mdi:loading" className="wo-weather-icon rotating" />
        <div className="wo-weather-temp">Loading...</div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="wo-weather-widget">
        <Icon icon="mdi:cloud-question" className="wo-weather-icon" />
        <div className="wo-weather-temp">N/A</div>
      </div>
    );
  }

  return (
    <div className="wo-weather-widget" title={`${weather.location}: ${weather.condition}`}>
      <div className="wo-weather-content">
        <Icon icon={weather.icon} className="wo-weather-icon" />
        <div className="wo-weather-info">
          <div className="wo-weather-temp">{weather.temp}°C</div>
          <div className="wo-weather-condition">{weather.condition}</div>
          <div className="wo-weather-location">{weather.location}</div>
        </div>
      </div>
      {weather.humidity !== undefined && (
        <div className="wo-weather-details">
          <div className="wo-weather-detail">
            <Icon icon="mdi:water-percent" />
            {weather.humidity}%
          </div>
        </div>
      )}
    </div>
  );
}

function mapWeatherCode(code: number): string {
  // WMO Weather interpretation codes
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly-cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "foggy";
  if (code >= 51 && code <= 67) return "rainy";
  if (code >= 80 && code <= 82) return "rainy";
  if (code >= 71 && code <= 77 || code === 85 || code === 86) return "snowy";
  if (code === 80 || code === 81) return "rainy";
  if (code >= 88 && code <= 99) return "thunderstorm";
  return "unknown";
}
