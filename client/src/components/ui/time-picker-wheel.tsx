import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TimePickerWheelProps {
  value: string; // Format: "HH:MM"
  onChange: (value: string) => void;
  className?: string;
}

export function TimePickerWheel({ value, onChange, className }: TimePickerWheelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState("12");
  const [minutes, setMinutes] = useState("00");
  const [period, setPeriod] = useState("AM");

  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      const hour24 = parseInt(h);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const newPeriod = hour24 >= 12 ? "PM" : "AM";

      setHours(hour12.toString().padStart(2, "0"));
      setMinutes(m);
      setPeriod(newPeriod);
    }
  }, [value]);

  // Generate arrays for wheel
  const hoursArray = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"));
  const minutesArray = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));
  const periodArray = ["AM", "PM"];

  const handleConfirm = () => {
    const hour24 = period === "PM"
      ? (parseInt(hours) === 12 ? 12 : parseInt(hours) + 12)
      : (parseInt(hours) === 12 ? 0 : parseInt(hours));

    onChange(`${hour24.toString().padStart(2, "0")}:${minutes}`);
    setIsOpen(false);
  };

  const scrollToCenter = (ref: React.RefObject<HTMLDivElement>, value: string, array: string[]) => {
    if (ref.current) {
      const index = array.indexOf(value);
      const itemHeight = 40;
      ref.current.scrollTop = index * itemHeight - itemHeight * 2;
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollToCenter(hoursRef, hours, hoursArray);
        scrollToCenter(minutesRef, minutes, minutesArray);
        scrollToCenter(periodRef, period, periodArray);
      }, 10);
    }
  }, [isOpen]);

  const handleScroll = (
    ref: React.RefObject<HTMLDivElement>,
    array: string[],
    setter: (value: string) => void
  ) => {
    if (ref.current) {
      const itemHeight = 40;
      const scrollTop = ref.current.scrollTop;
      const index = Math.round(scrollTop / itemHeight);
      const clampedIndex = Math.max(0, Math.min(array.length - 1, index));
      setter(array[clampedIndex]);
    }
  };

  const displayTime = value
    ? (() => {
        const [h, m] = value.split(":");
        const hour24 = parseInt(h);
        const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
        const displayPeriod = hour24 >= 12 ? "PM" : "AM";
        return `${hour12}:${m} ${displayPeriod}`;
      })()
    : "Select time";

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
      >
        <span className={cn("text-sm", !value && "text-muted-foreground")}>
          {displayTime}
        </span>
        <svg
          className="w-4 h-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-2 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="p-4">
              <div className="flex gap-2 mb-4">
                {/* Hours Wheel */}
                <div className="flex-1 relative">
                  <div className="text-xs text-center mb-2 text-muted-foreground font-medium">
                    Hour
                  </div>
                  <div className="relative h-[200px] overflow-hidden rounded-md bg-accent/20">
                    {/* Selection indicator */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[40px] border-y-2 border-primary/30 bg-primary/5 pointer-events-none z-10" />

                    <div
                      ref={hoursRef}
                      className="h-full overflow-y-scroll scrollbar-hide scroll-smooth"
                      onScroll={() => handleScroll(hoursRef, hoursArray, setHours)}
                      style={{ scrollSnapType: "y mandatory" }}
                    >
                      {/* Padding items */}
                      <div className="h-[80px]" />
                      {hoursArray.map((hour) => (
                        <div
                          key={hour}
                          className={cn(
                            "h-[40px] flex items-center justify-center text-lg font-medium transition-all cursor-pointer",
                            hours === hour
                              ? "text-foreground scale-110"
                              : "text-muted-foreground scale-90"
                          )}
                          style={{ scrollSnapAlign: "center" }}
                          onClick={() => {
                            setHours(hour);
                            scrollToCenter(hoursRef, hour, hoursArray);
                          }}
                        >
                          {hour}
                        </div>
                      ))}
                      <div className="h-[80px]" />
                    </div>
                  </div>
                </div>

                {/* Minutes Wheel */}
                <div className="flex-1 relative">
                  <div className="text-xs text-center mb-2 text-muted-foreground font-medium">
                    Minute
                  </div>
                  <div className="relative h-[200px] overflow-hidden rounded-md bg-accent/20">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[40px] border-y-2 border-primary/30 bg-primary/5 pointer-events-none z-10" />

                    <div
                      ref={minutesRef}
                      className="h-full overflow-y-scroll scrollbar-hide scroll-smooth"
                      onScroll={() => handleScroll(minutesRef, minutesArray, setMinutes)}
                      style={{ scrollSnapType: "y mandatory" }}
                    >
                      <div className="h-[80px]" />
                      {minutesArray.map((minute) => (
                        <div
                          key={minute}
                          className={cn(
                            "h-[40px] flex items-center justify-center text-lg font-medium transition-all cursor-pointer",
                            minutes === minute
                              ? "text-foreground scale-110"
                              : "text-muted-foreground scale-90"
                          )}
                          style={{ scrollSnapAlign: "center" }}
                          onClick={() => {
                            setMinutes(minute);
                            scrollToCenter(minutesRef, minute, minutesArray);
                          }}
                        >
                          {minute}
                        </div>
                      ))}
                      <div className="h-[80px]" />
                    </div>
                  </div>
                </div>

                {/* AM/PM Wheel */}
                <div className="w-20 relative">
                  <div className="text-xs text-center mb-2 text-muted-foreground font-medium">
                    Period
                  </div>
                  <div className="relative h-[200px] overflow-hidden rounded-md bg-accent/20">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[40px] border-y-2 border-primary/30 bg-primary/5 pointer-events-none z-10" />

                    <div
                      ref={periodRef}
                      className="h-full overflow-y-scroll scrollbar-hide scroll-smooth"
                      onScroll={() => handleScroll(periodRef, periodArray, setPeriod)}
                      style={{ scrollSnapType: "y mandatory" }}
                    >
                      <div className="h-[80px]" />
                      {periodArray.map((p) => (
                        <div
                          key={p}
                          className={cn(
                            "h-[40px] flex items-center justify-center text-lg font-medium transition-all cursor-pointer",
                            period === p
                              ? "text-foreground scale-110"
                              : "text-muted-foreground scale-90"
                          )}
                          style={{ scrollSnapAlign: "center" }}
                          onClick={() => {
                            setPeriod(p);
                            scrollToCenter(periodRef, p, periodArray);
                          }}
                        >
                          {p}
                        </div>
                      ))}
                      <div className="h-[80px]" />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirm}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
