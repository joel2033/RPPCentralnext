import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAvailableTimeSlots, usePublicBookingConfig } from "@/lib/booking";
import type { TeamMember, TimeSlot } from "@/lib/booking/types";
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
  Clock,
  User,
  AlertCircle,
  ChevronDown,
  Info,
} from "lucide-react";

interface BookingScheduleStepProps {
  partnerId: string;
  selectedDate: string;
  selectedTime: string;
  selectedTeamMemberId?: string;
  estimatedDuration: number;
  specialInstructions: string;
  allowTeamSelection: boolean;
  teamMembers: TeamMember[];
  propertyLocation?: { latitude: number; longitude: number };
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onTeamMemberChange: (id: string | undefined) => void;
  onInstructionsChange: (instructions: string) => void;
  onNext: () => void;
  onBack: () => void;
}

// Helper to format date as YYYY-MM-DD in local timezone (avoids timezone shift)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function BookingScheduleStep({
  partnerId,
  selectedDate,
  selectedTime,
  selectedTeamMemberId,
  estimatedDuration,
  specialInstructions,
  allowTeamSelection,
  teamMembers,
  propertyLocation,
  onDateChange,
  onTimeChange,
  onTeamMemberChange,
  onInstructionsChange,
  onNext,
  onBack,
}: BookingScheduleStepProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0); // For horizontal scrolling/navigation
  const { data: settings } = usePublicBookingConfig(partnerId);

  // Get available time slots for selected date
  const { slots: availableSlots, isLoading: driveTimesLoading } = useAvailableTimeSlots(
    partnerId,
    selectedDate ? new Date(selectedDate + "T00:00:00") : null,
    estimatedDuration,
    selectedTeamMemberId,
    propertyLocation
  );

  // Generate week days for calendar - starting from today + weekOffset
  const getWeekDays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + (weekOffset * 7));

    for (let i = 0; i < 14; i++) {
      // Show 14 days from the start
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }

    return days;
  };

  const weekDays = getWeekDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if date is selectable
  const isDateDisabled = (date: Date) => {
    if (date < today) return true;

    // Check minimum lead time
    if (settings?.minLeadTimeHours) {
      const now = new Date();
      const minDate = new Date(now.getTime() + settings.minLeadTimeHours * 60 * 60 * 1000);
      if (date < minDate) return true;
    }

    return false;
  };

  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    // Compare using local date string to avoid timezone issues
    return formatLocalDate(date) === selectedDate;
  };

  const hasAvailability = (date: Date) => {
    const day = date.getDay();
    // No availability on Sundays
    return day !== 0;
  };

  const selectDate = (date: Date) => {
    // Use local date formatting to avoid timezone shift issues
    const dateString = formatLocalDate(date);
    onDateChange(dateString);
    // Reset time when date changes
    if (selectedTime && selectedDate !== dateString) {
      onTimeChange("");
    }
  };

  // Helper function to convert 12-hour display format to 24-hour hour
  const getHour24 = (timeStr: string): number => {
    const hour = parseInt(timeStr.split(":")[0]);
    const isPM = timeStr.includes("PM");
    if (isPM && hour === 12) return 12; // 12 PM = 12
    if (isPM && hour !== 12) return hour + 12; // 1 PM = 13, 2 PM = 14, etc.
    if (!isPM && hour === 12) return 0; // 12 AM = 0
    return hour; // AM hours 1-11 stay the same
  };

  // Group time slots by period using 24-hour format
  const morningSlots = availableSlots.filter((slot) => {
    const hour24 = getHour24(slot.time);
    return hour24 < 12; // Before 12 PM
  });

  const afternoonSlots = availableSlots.filter((slot) => {
    const hour24 = getHour24(slot.time);
    return hour24 >= 12 && hour24 < 17; // 12 PM - 4 PM
  });

  const eveningSlots = availableSlots.filter((slot) => {
    const hour24 = getHour24(slot.time);
    return hour24 >= 17; // 5 PM onwards
  });

  const selectedDateObj = selectedDate
    ? new Date(selectedDate + "T00:00:00")
    : null;

  const canProceed = selectedDate && selectedTime;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b shadow-sm -mx-4 px-4 -mt-8 pt-8 pb-6 md:-mx-12 md:px-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              onClick={onBack}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold">Choose a Date & Time</h1>
            <div className="w-9" />
          </div>
          <p className="text-sm text-gray-500 text-center">
            Pick a date and time that suits you
          </p>
        </div>
      </div>

      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Team Member Selection */}
        {allowTeamSelection && teamMembers.length > 0 && (
          <div className="bg-gray-50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-[#f2572c]" />
              <Label className="font-medium">Select Photographer (Optional)</Label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onTeamMemberChange(undefined)}
                className={`px-4 py-3 rounded-xl border-2 transition-all ${
                  !selectedTeamMemberId
                    ? "border-[#f2572c] bg-white shadow-md"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="text-sm font-medium">Any Available</span>
              </button>
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => onTeamMemberChange(member.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                    selectedTeamMemberId === member.id
                      ? "border-[#f2572c] bg-white shadow-md"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={member.profileImage} />
                    <AvatarFallback
                      style={
                        member.color
                          ? { backgroundColor: member.color, color: "#fff" }
                          : undefined
                      }
                    >
                      {member.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{member.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Month/Year Selector */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">
              {currentMonth.toLocaleDateString("en-AU", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <button className="p-1 hover:bg-gray-100 rounded">
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() - 1,
                    1
                  )
                )
              }
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1,
                    1
                  )
                )
              }
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Week View with Navigation */}
        <div className="relative">
          {/* Previous Week Button */}
          {weekOffset > 0 && (
            <button
              onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50 border"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Next Week Button */}
          <button
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50 border"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="overflow-x-auto pb-2 px-8">
            <div className="flex gap-2 min-w-max">
              {weekDays.map((date, index) => {
                const disabled = isDateDisabled(date);
                const selected = isDateSelected(date);
                const available = hasAvailability(date);
                const isToday = formatLocalDate(date) === formatLocalDate(new Date());

                return (
                  <button
                    key={formatLocalDate(date)}
                    onClick={() => !disabled && selectDate(date)}
                    disabled={disabled}
                    className={`flex-shrink-0 w-20 p-3 rounded-xl border-2 transition-all relative ${
                      disabled
                        ? "border-gray-100 bg-gray-50 cursor-not-allowed opacity-40"
                        : selected
                          ? "border-[#f2572c] bg-[#f2572c] text-white shadow-md"
                          : "border-gray-200 hover:border-[#f2572c]/50 hover:shadow-sm"
                    }`}
                  >
                    <div className="text-center">
                      <p
                        className={`text-xs mb-1 ${
                          selected ? "text-white/80" : "text-gray-500"
                        }`}
                      >
                        {date.toLocaleDateString("en-AU", {
                          weekday: "short",
                        })}
                      </p>
                      <p
                        className={`text-xl font-semibold ${
                          selected
                            ? "text-white"
                            : isToday
                              ? "text-[#f2572c]"
                              : ""
                        }`}
                      >
                        {date.getDate()}
                      </p>
                      {!disabled && available && (
                        <div
                          className={`w-1.5 h-1.5 rounded-full mx-auto mt-2 ${
                            selected ? "bg-white" : "bg-green-500"
                          }`}
                        />
                      )}
                      {!disabled && !available && (
                        <div
                          className={`w-1.5 h-1.5 rounded-full mx-auto mt-2 ${
                            selected ? "bg-white" : "bg-red-500"
                          }`}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Date Display */}
        {selectedDateObj && (
          <div className="text-center py-4 border-y">
            <p className="text-lg font-medium">
              {selectedDateObj.toLocaleDateString("en-AU", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Times shown in your local timezone
            </p>
          </div>
        )}

        {/* Time Slots */}
        {selectedDate && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Drive Time Loading Indicator */}
            {driveTimesLoading && propertyLocation && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Calculating drive times for accurate availability...</span>
              </div>
            )}
            
            {/* Morning Slots */}
            {morningSlots.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-amber-400 rounded-full" />
                  <h4 className="text-sm text-gray-500">Morning</h4>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {morningSlots.map((slot) => (
                    <TimeSlotButton
                      key={slot.time}
                      slot={slot}
                      isSelected={selectedTime === slot.time}
                      onClick={() => slot.available && onTimeChange(slot.time)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Afternoon Slots */}
            {afternoonSlots.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-orange-400 rounded-full" />
                  <h4 className="text-sm text-gray-500">Afternoon</h4>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {afternoonSlots.map((slot) => (
                    <TimeSlotButton
                      key={slot.time}
                      slot={slot}
                      isSelected={selectedTime === slot.time}
                      onClick={() => slot.available && onTimeChange(slot.time)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Evening Slots */}
            {eveningSlots.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-indigo-400 rounded-full" />
                  <h4 className="text-sm text-gray-500">Evening</h4>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {eveningSlots.map((slot) => (
                    <TimeSlotButton
                      key={slot.time}
                      slot={slot}
                      isSelected={selectedTime === slot.time}
                      onClick={() => slot.available && onTimeChange(slot.time)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* No slots available */}
            {morningSlots.length === 0 &&
              afternoonSlots.length === 0 &&
              eveningSlots.length === 0 && (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">
                    No available times on this date
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Please select a different date
                  </p>
                </div>
              )}
          </div>
        )}

        {/* Special Instructions */}
        {selectedTime && (
          <div className="animate-in fade-in duration-300 pt-4 border-t">
            <Label htmlFor="specialInstructions">
              Special Instructions (Optional)
            </Label>
            <Textarea
              id="specialInstructions"
              placeholder="Any special requests, access codes, or parking instructions..."
              value={specialInstructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              className="mt-1.5 rounded-xl min-h-20"
            />
          </div>
        )}

        {/* Duration Estimate */}
        {estimatedDuration > 0 && selectedTime && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-900 font-medium mb-0.5">
                  Estimated Shoot Duration
                </p>
                <p className="text-xs text-blue-700">
                  Please plan for approximately{" "}
                  {Math.ceil(estimatedDuration / 60)} hour
                  {Math.ceil(estimatedDuration / 60) > 1 ? "s" : ""} for the
                  photographer to complete all services.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Availability Legend */}
        {!selectedDate && (
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500 pt-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span>Limited</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-6 border-t">
          <Button
            variant="outline"
            onClick={onBack}
            className="h-11 px-6 rounded-xl"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={onNext}
            disabled={!canProceed}
            className="h-11 px-6 rounded-xl bg-[#f2572c] hover:bg-[#d94820] ml-auto"
          >
            Continue
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Time Slot Button Component
function TimeSlotButton({
  slot,
  isSelected,
  onClick,
}: {
  slot: TimeSlot;
  isSelected: boolean;
  onClick: () => void;
}) {
  const buttonContent = (
    <button
      onClick={onClick}
      disabled={!slot.available}
      className={`py-2.5 px-3 rounded-lg text-sm transition-all border relative ${
        !slot.available
          ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
          : isSelected
            ? "border-[#f2572c] bg-[#f2572c] text-white shadow-sm"
            : "border-gray-200 hover:border-[#f2572c]/50 hover:bg-gray-50"
      }`}
    >
      {slot.time.replace(":00", "").replace(":30", ":30")}
      {!slot.available && slot.conflictReason && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center">
          <Info className="w-2 h-2 text-white" />
        </span>
      )}
    </button>
  );

  // Show tooltip with conflict reason for unavailable slots
  if (!slot.available && slot.conflictReason) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="max-w-xs bg-gray-900 text-white text-xs p-2 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <span>{slot.conflictReason}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
}

export default BookingScheduleStep;

