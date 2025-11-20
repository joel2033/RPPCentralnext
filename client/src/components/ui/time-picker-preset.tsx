import { useState } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimePickerPresetProps {
  value: string; // Format: "HH:MM"
  onChange: (value: string) => void;
  className?: string;
  interval?: number; // Interval in minutes (5, 10, 15, 30)
}

export function TimePickerPreset({ value, onChange, className, interval = 5 }: TimePickerPresetProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Generate time options based on interval
  const generateTimeOptions = () => {
    const options: string[] = [];
    const totalMinutes = 24 * 60; // Total minutes in a day

    for (let minutes = 0; minutes < totalMinutes; minutes += interval) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const period = hours >= 12 ? "PM" : "AM";
      const timeString = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
      const displayString = `${hour12}:${mins.toString().padStart(2, "0")} ${period}`;

      options.push(timeString);
    }

    return options;
  };

  const timeOptions = generateTimeOptions();

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":");
    const hour24 = parseInt(h);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const period = hour24 >= 12 ? "PM" : "AM";
    return `${hour12}:${m} ${period}`;
  };

  const handleSelect = (time: string) => {
    onChange(time);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
      >
        <span className={cn("text-sm", !value && "text-muted-foreground")}>
          {value ? formatDisplayTime(value) : "Select time"}
        </span>
        <Clock className="w-4 h-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-2 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            <ScrollArea className="h-[300px]">
              <div className="p-2">
                {timeOptions.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleSelect(time)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                      time === value
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {formatDisplayTime(time)}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}
