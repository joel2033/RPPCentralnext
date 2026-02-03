import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerBookingConfig } from "@/lib/booking";
import { apiRequest } from "@/lib/queryClient";
import { auth } from "@/lib/firebase";
import type { BookingFormSettings as BookingSettings, CustomQuestion } from "@/lib/booking/types";
import {
  Link2,
  Copy,
  Check,
  Clock,
  Car,
  Users,
  CreditCard,
  MessageSquarePlus,
  Plus,
  Trash2,
  GripVertical,
  ExternalLink,
  Settings,
  MapPin,
  Calendar,
  Loader2,
} from "lucide-react";

export interface BookingFormSettingsProps {
  onRegisterSave?: (handler: () => void) => void;
}

export function BookingFormSettings({ onRegisterSave }: BookingFormSettingsProps) {
  const { userData } = useAuth();
  const { toast } = useToast();
  const partnerId = userData?.partnerId;

  const {
    settings,
    isLoading,
    updateSettings,
    isUpdating,
  } = usePartnerBookingConfig(partnerId);

  const queryClient = useQueryClient();
  const { data: calendarStatus, isLoading: calendarStatusLoading } = useQuery<{ connected: boolean; twoWaySyncEnabled: boolean }>({
    queryKey: ["/api/calendar/google/status"],
    enabled: !!partnerId,
    queryFn: async () => {
      const res = await apiRequest("/api/calendar/google/status", "GET");
      return res.json();
    },
  });
  const updateCalendarSettingsMutation = useMutation({
    mutationFn: async (twoWaySyncEnabled: boolean) => {
      const res = await apiRequest("/api/calendar/google/settings", "PUT", { twoWaySyncEnabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/google/status"] });
    },
  });
  const disconnectCalendarMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/calendar/google/disconnect", "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/google/status"] });
    },
  });

  // Local state for form
  const [formState, setFormState] = useState<Partial<BookingSettings>>({});
  const [copied, setCopied] = useState(false);

  // Initialize form state from settings with defaults for missing values
  useEffect(() => {
    if (settings) {
      console.log('[BookingFormSettings] Settings loaded, timeSlotInterval:', settings.timeSlotInterval);
      // Ensure all fields have proper defaults
      setFormState({
        ...settings,
        timeSlotInterval: settings.timeSlotInterval ?? 30,
        bufferMinutes: settings.bufferMinutes ?? 30,
        minLeadTimeHours: settings.minLeadTimeHours ?? 24,
        maxDriveDistanceKm: settings.maxDriveDistanceKm ?? 50,
      });
    }
  }, [settings]);

  const handleCopyLink = () => {
    const bookingLink = `${window.location.origin}/book/${partnerId}`;
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link Copied!",
      description: "Booking link copied to clipboard",
    });
  };

  const handleSave = useCallback(() => {
    console.log('[BookingFormSettings] handleSave called with formState:', formState);
    console.log('[BookingFormSettings] timeSlotInterval:', formState.timeSlotInterval);
    updateSettings(formState);
    toast({
      title: "Settings Saved!",
      description: "Your booking form settings have been updated.",
    });
  }, [formState, updateSettings, toast]);

  // Expose save handler to parent (Settings page) if requested
  useEffect(() => {
    if (onRegisterSave) {
      onRegisterSave(handleSave);
    }
  }, [onRegisterSave, handleSave]);

  // Handle OAuth redirect (Google Calendar connect callback)
  useEffect(() => {
    const hash = window.location.hash || "";
    const parts = hash.replace("#", "").split("&");
    const params = Object.fromEntries(parts.map((p) => {
      const [k, v] = p.split("=");
      return [k || "", v || ""];
    }));
    const calendarConnected = params.calendar_connected === "1";
    const calendarError = params.calendar_error ? decodeURIComponent(params.calendar_error) : null;
    if (calendarConnected) {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/google/status"] });
      toast({ title: "Google Calendar connected", description: "Your calendar is now linked." });
      window.history.replaceState(null, "", window.location.pathname + "#booking");
    }
    if (calendarError) {
      toast({ title: "Google Calendar error", description: calendarError, variant: "destructive" });
      window.history.replaceState(null, "", window.location.pathname + "#booking");
    }
  }, [queryClient, toast]);

  const handleConnectGoogleCalendar = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/google/auth-url", {
        method: "GET",
        headers: auth.currentUser
          ? { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }
          : {},
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503 && (data.code === "GOOGLE_CALENDAR_NOT_CONFIGURED" || data.code === "GOOGLE_CALENDAR_BASE_URL_REQUIRED")) {
          toast({
            title: "Google Calendar not configured",
            description: data.detail || "Add GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET (and BASE_URL if needed) to the server environment.",
            variant: "destructive",
          });
          return;
        }
        const errMsg = data.error || data.detail || `Request failed (${res.status})`;
        toast({
          title: "Failed to connect",
          description: typeof errMsg === "string" ? errMsg : String(data.error || res.status),
          variant: "destructive",
        });
        return;
      }
      if (data.authUrl) window.location.href = data.authUrl;
    } catch (e) {
      toast({ title: "Failed to connect", description: (e as Error).message, variant: "destructive" });
    }
  }, [toast]);

  // Custom questions management
  const addCustomQuestion = () => {
    const newQuestion: CustomQuestion = {
      id: `q-${Date.now()}`,
      question: "",
      type: "text",
      required: false,
      order: (formState.customQuestions?.length || 0) + 1,
    };
    setFormState((prev) => ({
      ...prev,
      customQuestions: [...(prev.customQuestions || []), newQuestion],
    }));
  };

  const updateCustomQuestion = (
    id: string,
    updates: Partial<CustomQuestion>
  ) => {
    setFormState((prev) => ({
      ...prev,
      customQuestions: prev.customQuestions?.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      ),
    }));
  };

  const removeCustomQuestion = (id: string) => {
    setFormState((prev) => ({
      ...prev,
      customQuestions: prev.customQuestions?.filter((q) => q.id !== id),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#f2572c] rounded-full animate-spin" />
      </div>
    );
  }

  const bookingLink = `${window.location.origin}/book/${partnerId}`;

  return (
    <div className="space-y-6">
      {/* Booking Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Your Booking Link
          </CardTitle>
          <p className="text-sm text-gray-600">
            Share this link with clients to allow them to book appointments
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 font-mono text-sm truncate">
              {bookingLink}
            </div>
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </Button>
            <Button variant="outline" asChild>
              <a href={bookingLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Preview
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Switch
              checked={formState.isEnabled ?? true}
              onCheckedChange={(checked) =>
                setFormState((prev) => ({ ...prev, isEnabled: checked }))
              }
            />
            <Label>Enable online booking</Label>
          </div>
        </CardContent>
      </Card>

      {/* Google Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Google Calendar
          </CardTitle>
          <p className="text-sm text-gray-600">
            Sync appointments to Google Calendar and block out times from your calendar when two-way sync is on
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {calendarStatusLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : calendarStatus?.connected ? (
            <>
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-4 h-4" />
                <span>Connected to Google Calendar</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <Label className="font-medium">Two-way sync</Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Block out times in booking when you have events in Google Calendar
                  </p>
                </div>
                <Switch
                  checked={calendarStatus.twoWaySyncEnabled}
                  onCheckedChange={(checked) => updateCalendarSettingsMutation.mutate(checked)}
                  disabled={updateCalendarSettingsMutation.isPending}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => disconnectCalendarMutation.mutate()}
                disabled={disconnectCalendarMutation.isPending}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {disconnectCalendarMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={handleConnectGoogleCalendar} className="gap-2">
              <Calendar className="w-4 h-4" />
              Connect Google Calendar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Client Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Client Settings
          </CardTitle>
          <p className="text-sm text-gray-600">
            Control who can book through your booking form
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <Label className="font-medium">
                  Allow New Clients
                </Label>
                <p className="text-sm text-gray-500 mt-1">
                  Allow clients who are not in your system to make bookings
                </p>
              </div>
              <Switch
                checked={formState.allowNewClients ?? true}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    allowNewClients: checked,
                  }))
                }
              />
            </div>
            
            {!formState.allowNewClients && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-900">
                  <strong>Note:</strong> Only existing clients in your customer database
                  will be able to make bookings. New clients will be shown a message
                  to contact you directly.
                </p>
              </div>
            )}
          </CardContent>
      </Card>

      {/* Scheduling Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Scheduling Rules
          </CardTitle>
          <p className="text-sm text-gray-600">
            Configure booking lead times and buffer periods
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="minLeadTime">Minimum Booking Notice</Label>
                <Select
                  value={formState.minLeadTimeHours?.toString() || "24"}
                  onValueChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      minLeadTimeHours: parseInt(value),
                    }))
                  }
                >
                  <SelectTrigger id="minLeadTime">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No minimum</SelectItem>
                    <SelectItem value="2">2 hours</SelectItem>
                    <SelectItem value="4">4 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours</SelectItem>
                    <SelectItem value="72">72 hours</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  How far in advance clients must book
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bufferMinutes">Buffer Between Appointments</Label>
                <Select
                  value={formState.bufferMinutes?.toString() || "30"}
                  onValueChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      bufferMinutes: parseInt(value),
                    }))
                  }
                >
                  <SelectTrigger id="bufferMinutes">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No buffer</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Time buffer between back-to-back bookings
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeSlotInterval">Time Slot Interval</Label>
              <Select
                value={formState.timeSlotInterval?.toString() || "30"}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    timeSlotInterval: parseInt(value),
                  }))
                }
              >
                <SelectTrigger id="timeSlotInterval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Every 5 minutes</SelectItem>
                  <SelectItem value="10">Every 10 minutes</SelectItem>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Available time slots shown to clients (e.g., 9:00, 9:15, 9:30...)
              </p>
            </div>
          </CardContent>
      </Card>

      {/* Travel Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Travel Settings
          </CardTitle>
          <p className="text-sm text-gray-600">
            Control maximum driving distances between shoots
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="maxDriveDistance">Maximum Driving Distance</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="maxDriveDistance"
                  type="number"
                  value={formState.maxDriveDistanceKm || 50}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      maxDriveDistanceKm: parseInt(e.target.value) || 50,
                    }))
                  }
                  className="w-24"
                />
                <span className="text-gray-600">km</span>
              </div>
              <p className="text-xs text-gray-500">
                The system will check drive times between appointments and warn
                if the distance exceeds this limit
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> Drive time calculations help ensure
                realistic scheduling. The system will account for travel time
                when showing available slots to clients.
              </p>
            </div>
          </CardContent>
      </Card>

      {/* Service Area Restrictions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Service Area Restrictions (If applicable)
          </CardTitle>
          <p className="text-sm text-gray-600">
            Control where new bookings can be made by restricting them to your specified service areas.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() =>
                setFormState((prev) => ({
                  ...prev,
                  restrictToServiceAreas: false,
                }))
              }
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                formState.restrictToServiceAreas === false || formState.restrictToServiceAreas === undefined
                  ? "border-[#f2572c] bg-[#f2572c]/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                  formState.restrictToServiceAreas === false || formState.restrictToServiceAreas === undefined
                    ? "border-[#f2572c]"
                    : "border-gray-300"
                }`}>
                  {(formState.restrictToServiceAreas === false || formState.restrictToServiceAreas === undefined) && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#f2572c]" />
                  )}
                </div>
                <div>
                  <Label className="font-medium cursor-pointer">Allow bookings in all areas</Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Enable this option if you want to accept bookings for any location, even outside of your predefined service areas. Ideal for businesses with a broader reach.
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setFormState((prev) => ({
                  ...prev,
                  restrictToServiceAreas: true,
                }))
              }
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                formState.restrictToServiceAreas === true
                  ? "border-[#f2572c] bg-[#f2572c]/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                  formState.restrictToServiceAreas === true
                    ? "border-[#f2572c]"
                    : "border-gray-300"
                }`}>
                  {formState.restrictToServiceAreas === true && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#f2572c]" />
                  )}
                </div>
                <div>
                  <Label className="font-medium cursor-pointer">Restrict to service areas only</Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose this option to limit bookings to your designated service areas. Customers located outside these areas will be prompted to contact you.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Team Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Selection
          </CardTitle>
          <p className="text-sm text-gray-600">
            Allow clients to choose specific team members
          </p>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <Label className="font-medium">
                  Allow Photographer Selection
                </Label>
                <p className="text-sm text-gray-500 mt-1">
                  Clients can select their preferred photographer when booking
                </p>
              </div>
              <Switch
                checked={formState.allowTeamSelection ?? false}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    allowTeamSelection: checked,
                  }))
                }
              />
            </div>
          </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Settings
          </CardTitle>
          <p className="text-sm text-gray-600">
            Configure payment options for bookings
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <Label className="font-medium">Enable Payments</Label>
                <p className="text-sm text-gray-500 mt-1">
                  Require payment or deposit at booking
                </p>
              </div>
              <Switch
                checked={formState.paymentEnabled ?? false}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    paymentEnabled: checked,
                  }))
                }
              />
            </div>

            {formState.paymentEnabled && (
              <>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "stripe", label: "Credit Card (Stripe)" },
                      { value: "invoice", label: "Invoice Only" },
                      { value: "both", label: "Both Options" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() =>
                          setFormState((prev) => ({
                            ...prev,
                            paymentMethod: option.value as any,
                          }))
                        }
                        className={`p-3 rounded-xl border-2 transition-all text-sm ${
                          formState.paymentMethod === option.value
                            ? "border-[#f2572c] bg-[#f2572c]/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <Label className="font-medium">Require Deposit</Label>
                    <p className="text-sm text-gray-500 mt-1">
                      Collect a deposit at booking time
                    </p>
                  </div>
                  <Switch
                    checked={formState.depositEnabled ?? false}
                    onCheckedChange={(checked) =>
                      setFormState((prev) => ({
                        ...prev,
                        depositEnabled: checked,
                      }))
                    }
                  />
                </div>

                {formState.depositEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Deposit Type</Label>
                      <Select
                        value={formState.depositType || "percentage"}
                        onValueChange={(value) =>
                          setFormState((prev) => ({
                            ...prev,
                            depositType: value as any,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Deposit Amount</Label>
                      <div className="flex items-center gap-2">
                        {formState.depositType === "percentage" && (
                          <span className="text-gray-500">%</span>
                        )}
                        {formState.depositType === "fixed" && (
                          <span className="text-gray-500">$</span>
                        )}
                        <Input
                          type="number"
                          value={formState.depositAmount || 25}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              depositAmount: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="w-24"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formState.paymentMethod !== "invoice" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm text-amber-900">
                      <strong>Stripe Integration:</strong> To accept credit card
                      payments, connect your Stripe account in Settings →
                      Integrations.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
      </Card>

      {/* Custom Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5" />
            Custom Questions
          </CardTitle>
          <p className="text-sm text-gray-600">
            Add custom questions to gather additional information from clients
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
            {formState.customQuestions?.map((question, index) => (
              <div
                key={question.id}
                className="p-4 border rounded-xl space-y-4"
              >
                <div className="flex items-start gap-3">
                  <GripVertical className="w-5 h-5 text-gray-400 mt-1 cursor-move" />
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Question</Label>
                        <Input
                          value={question.question}
                          onChange={(e) =>
                            updateCustomQuestion(question.id, {
                              question: e.target.value,
                            })
                          }
                          placeholder="Enter your question..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={question.type}
                          onValueChange={(value) =>
                            updateCustomQuestion(question.id, {
                              type: value as any,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Short Text</SelectItem>
                            <SelectItem value="textarea">Long Text</SelectItem>
                            <SelectItem value="select">Dropdown</SelectItem>
                            <SelectItem value="checkbox">Checkbox</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {question.type === "select" && (
                      <div className="space-y-2">
                        <Label>Options (one per line)</Label>
                        <Textarea
                          value={question.options?.join("\n") || ""}
                          onChange={(e) =>
                            updateCustomQuestion(question.id, {
                              options: e.target.value.split("\n").filter(Boolean),
                            })
                          }
                          placeholder="Option 1&#10;Option 2&#10;Option 3"
                          rows={3}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={question.required}
                          onCheckedChange={(checked) =>
                            updateCustomQuestion(question.id, {
                              required: checked,
                            })
                          }
                        />
                        <Label className="text-sm">Required</Label>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCustomQuestion(question.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={addCustomQuestion}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
          </CardContent>
      </Card>

    </div>
  );
}

export default BookingFormSettings;

