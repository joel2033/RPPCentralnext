import { useEffect, useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { auth } from "@/lib/firebase";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Check, DollarSign, Settings, Calendar, RefreshCw } from "lucide-react";
import { XeroConfigSection } from "./XeroConfigSection";

interface IntegrationsSectionProps {
  /** When set, the parent can trigger Xero config save from its main Save button. Handler may be null to unregister. */
  onRegisterXeroSave?: (handler: (() => void) | null) => void;
}

export function IntegrationsSection({ onRegisterXeroSave }: IntegrationsSectionProps = {}) {
  const { userData } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const partnerId = userData?.partnerId;
  const [configOpen, setConfigOpen] = useState(false);

  const {
    data: xeroStatus,
    isLoading: xeroStatusLoading,
  } = useQuery<{ connected: boolean; tenantName?: string }>({
    queryKey: ["/api/auth/xero/status"],
    enabled: !!partnerId,
  });

  const disconnectXeroMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/auth/xero/disconnect", "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/xero/status"] });
      toast({
        title: "Xero disconnected",
        description: "Your Xero connection has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to disconnect",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle OAuth redirect params from Xero callback
  useEffect(() => {
    const hash = window.location.hash || "";
    const parts = hash.replace("#", "").split("&");
    const params = Object.fromEntries(
      parts.map((p) => {
        const [k, v] = p.split("=");
        return [k || "", v || ""];
      })
    );
    const xeroConnected = params.xero_connected === "1";
    const xeroError = params.xero_error ? decodeURIComponent(params.xero_error) : null;
    if (xeroConnected) {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/xero/status"] });
      toast({
        title: "Xero connected",
        description: "Your Xero account is now linked.",
      });
      window.history.replaceState(null, "", window.location.pathname + "#integrations");
    }
    if (xeroError) {
      toast({
        title: "Xero connection error",
        description: xeroError,
        variant: "destructive",
      });
      window.history.replaceState(null, "", window.location.pathname + "#integrations");
    }
  }, [queryClient, toast]);

  // Google Calendar
  const { data: calendarStatus, isLoading: calendarStatusLoading } = useQuery<{ connected: boolean; twoWaySyncEnabled: boolean }>({
    queryKey: ["/api/calendar/google/status"],
    enabled: !!partnerId,
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
      toast({ title: "Google Calendar disconnected" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to disconnect", description: error.message, variant: "destructive" });
    },
  });

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
      window.history.replaceState(null, "", window.location.pathname + "#integrations");
    }
    if (calendarError) {
      toast({ title: "Google Calendar error", description: calendarError, variant: "destructive" });
      window.history.replaceState(null, "", window.location.pathname + "#integrations");
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
        toast({ title: "Failed to connect", description: typeof errMsg === "string" ? errMsg : String(errMsg), variant: "destructive" });
        return;
      }
      if (data.authUrl) window.location.href = data.authUrl;
    } catch (e) {
      toast({ title: "Failed to connect", description: (e as Error).message, variant: "destructive" });
    }
  }, [toast]);

  const handleConnectXero = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/xero/auth-url", {
        method: "GET",
        headers: auth.currentUser
          ? { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }
          : {},
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (
          res.status === 503 &&
          (data.code === "XERO_NOT_CONFIGURED" || data.code === "XERO_BASE_URL_REQUIRED")
        ) {
          toast({
            title: "Xero not configured",
            description:
              data.detail ||
              "Add XERO_CLIENT_ID and XERO_CLIENT_SECRET (and BASE_URL if needed) to the server environment.",
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
      const { authUrl } = data;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        toast({
          title: "Invalid response",
          description: "No auth URL received",
          variant: "destructive",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect";
      toast({
        title: "Connection failed",
        description: msg,
        variant: "destructive",
      });
    }
  }, [toast]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Integrations</h2>
      <p className="text-sm text-gray-600">
        Connect third-party services and accounting software to your account.
      </p>

      {/* Xero */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <img src="/assets/xero-logo.png" alt="Xero" className="h-8" />
          </CardTitle>
          <p className="text-sm text-gray-600">
            Connect Xero to sync invoices and contacts with your accounting software.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {xeroStatusLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : xeroStatus?.connected ? (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-4 h-4" />
                  <span>
                    {xeroStatus.tenantName
                      ? `Connected to ${xeroStatus.tenantName}`
                      : "Connected to Xero"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Sheet open={configOpen} onOpenChange={setConfigOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Settings className="w-4 h-4" />
                        Configure
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Xero Configuration</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <XeroConfigSection embedded onRegisterSave={onRegisterXeroSave} onClose={() => setConfigOpen(false)} />
                      </div>
                    </SheetContent>
                  </Sheet>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnectXeroMutation.mutate()}
                    disabled={disconnectXeroMutation.isPending}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
                  >
                    {disconnectXeroMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <DollarSign className="w-4 h-4" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <Button onClick={handleConnectXero} className="gap-2">
              <DollarSign className="w-4 h-4" />
              Connect Xero
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Google Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <img src="/assets/google-calendar-logo.png" alt="Google Calendar" className="h-8" />
          </CardTitle>
          <p className="text-sm text-gray-600">
            Connect your Google Calendar to sync appointments and block out times when you're busy.
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectGoogleCalendar}
                  disabled={disconnectCalendarMutation.isPending}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reconnect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectCalendarMutation.mutate()}
                  disabled={disconnectCalendarMutation.isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
                >
                  {disconnectCalendarMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={handleConnectGoogleCalendar}
              className="gap-2 bg-[var(--rpp-orange-subtle)] text-rpp-grey-darkest hover:bg-[rgba(240,90,42,0.2)] active:bg-[rgba(240,90,42,0.28)]"
            >
              <Calendar className="w-4 h-4" />
              Connect Google Calendar
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
