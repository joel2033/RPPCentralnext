import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";

interface DatePickerProps {
  value: string; // Format: "YYYY-MM-DD"
  onChange: (value: string) => void;
  className?: string;
  minDate?: string;
}

export function DatePicker({ value, onChange, className, minDate }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    if (value) {
      setSelectedDate(new Date(value + "T00:00:00"));
      setCurrentMonth(new Date(value + "T00:00:00"));
    } else {
      setCurrentMonth(new Date());
    }
  }, [value]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateClick = (date: Date) => {
    if (minDate) {
      const min = new Date(minDate + "T00:00:00");
      if (date < min) return;
    }

    setSelectedDate(date);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    onChange(`${year}-${month}-${day}`);
    setIsOpen(false);
  };

  const isDateDisabled = (date: Date | null) => {
    if (!date) return false;
    if (!minDate) return false;
    const min = new Date(minDate + "T00:00:00");
    return date < min;
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date | null) => {
    if (!date || !selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
      >
        <span className={cn("text-sm", !value && "text-muted-foreground")}>
          {value ? formatDisplayDate(value) : "Select a date"}
        </span>
        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-2 w-full min-w-[280px] bg-popover border border-border rounded-lg shadow-lg p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handlePreviousMonth}
                className="p-1 hover:bg-accent rounded-md transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="font-semibold text-sm">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-accent rounded-md transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Day Names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="text-xs font-medium text-muted-foreground text-center py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => date && !isDateDisabled(date) && handleDateClick(date)}
                  disabled={!date || isDateDisabled(date)}
                  className={cn(
                    "aspect-square flex items-center justify-center rounded-md text-sm transition-all",
                    !date && "invisible",
                    date && !isDateDisabled(date) && "hover:bg-accent cursor-pointer",
                    isDateDisabled(date) && "text-muted-foreground/30 cursor-not-allowed",
                    isToday(date) && !isSelected(date) && "border border-primary/50",
                    isSelected(date) && "bg-primary text-primary-foreground font-semibold hover:bg-primary"
                  )}
                >
                  {date?.getDate()}
                </button>
              ))}
            </div>

            {/* Today Button */}
            <div className="mt-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  handleDateClick(today);
                }}
                className="w-full py-1.5 text-sm text-primary hover:bg-accent rounded-md transition-colors font-medium"
              >
                Today
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
