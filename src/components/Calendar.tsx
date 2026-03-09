import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import './Calendar.css';

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const daysInMonth = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (number | null)[] = [];
    
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= totalDays; day++) {
      days.push(day);
    }

    return days;
  }, [year, month]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  return (
    <div className="calendar-popup">
      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={goToPrevMonth} title="Previous month">
          <Icon icon="mdi:chevron-left" width={20} height={20} />
        </button>
        <div className="calendar-month-year">{monthName}</div>
        <button className="calendar-nav-btn" onClick={goToNextMonth} title="Next month">
          <Icon icon="mdi:chevron-right" width={20} height={20} />
        </button>
      </div>

      <div className="calendar-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="calendar-weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {daysInMonth.map((day, index) => (
          <div
            key={index}
            className={`calendar-day ${day ? 'calendar-day-active' : ''} ${
              isToday(day) ? 'calendar-day-today' : ''
            }`}
          >
            {day}
          </div>
        ))}
      </div>
    </div>
  );
}
