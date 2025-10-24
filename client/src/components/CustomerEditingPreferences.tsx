import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Check, Settings, FileText, Info } from "lucide-react";
import { Trees, Cloud, Droplets, Palette, Sun, Sparkles, Image as ImageIcon, Flame } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

interface EditingPreference {
  id: string;
  partnerId: string;
  name: string;
  description: string | null;
  icon: string | null;
  iconColor: string | null;
  displayOrder: number;
  isActive: boolean;
  isEnabled: boolean;
  notes: string | null;
  preferenceId: string | null;
}

interface CustomerEditingPreferencesProps {
  customerId: string;
  customerName?: string;
}

const getIconComponent = (iconName: string | null) => {
  const icons: Record<string, any> = {
    Trees,
    Cloud,
    Droplets,
    Palette,
    Sun,
    Sparkles,
    ImageIcon,
    Flame,
  };
  return icons[iconName || "Settings"] || Settings;
};

const getIconColorClasses = (iconColor: string | null): { bg: string; text: string } => {
  const colorMap: Record<string, { bg: string; text: string }> = {
    'text-green-600': { bg: 'bg-green-100', text: 'text-green-700' },
    'text-green-700': { bg: 'bg-green-100', text: 'text-green-700' },
    'text-orange-600': { bg: 'bg-orange-100', text: 'text-orange-700' },
    'text-orange-700': { bg: 'bg-orange-100', text: 'text-orange-700' },
    'text-blue-600': { bg: 'bg-blue-100', text: 'text-blue-700' },
    'text-blue-700': { bg: 'bg-blue-100', text: 'text-blue-700' },
    'text-amber-600': { bg: 'bg-amber-100', text: 'text-amber-700' },
    'text-amber-700': { bg: 'bg-amber-100', text: 'text-amber-700' },
    'text-cyan-600': { bg: 'bg-cyan-100', text: 'text-cyan-700' },
    'text-cyan-700': { bg: 'bg-cyan-100', text: 'text-cyan-700' },
    'text-purple-600': { bg: 'bg-purple-100', text: 'text-purple-700' },
    'text-purple-700': { bg: 'bg-purple-100', text: 'text-purple-700' },
    'text-pink-600': { bg: 'bg-pink-100', text: 'text-pink-700' },
    'text-pink-700': { bg: 'bg-pink-100', text: 'text-pink-700' },
    'text-indigo-600': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    'text-indigo-700': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  };
  return colorMap[iconColor || ''] || { bg: 'bg-gray-100', text: 'text-gray-700' };
};

export default function CustomerEditingPreferences({ customerId, customerName }: CustomerEditingPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [preferences, setPreferences] = useState<Record<string, { isEnabled: boolean; notes: string }>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [globalNotes, setGlobalNotes] = useState("");

  const { data: detailedPreferences = [], isLoading } = useQuery<EditingPreference[]>({
    queryKey: [`/api/customers/${customerId}/editing-preferences/detailed`],
    enabled: !!customerId,
  });

  // Initialize local state when data is loaded
  useEffect(() => {
    if (detailedPreferences.length > 0) {
      const initialPrefs: Record<string, { isEnabled: boolean; notes: string }> = {};
      detailedPreferences.forEach(pref => {
        initialPrefs[pref.id] = {
          isEnabled: pref.isEnabled,
          notes: pref.notes || ""
        };
      });
      setPreferences(initialPrefs);
    }
  }, [detailedPreferences]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const preferencesToSave = detailedPreferences.map(pref => ({
        editingOptionId: pref.id,
        isEnabled: preferences[pref.id]?.isEnabled || false,
        notes: preferences[pref.id]?.notes || undefined
      }));

      return apiRequest(`/api/customers/${customerId}/editing-preferences`, "POST", {
        preferences: preferencesToSave,
        globalNotes: globalNotes || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/editing-preferences/detailed`] });
      toast({
        title: "Preferences Saved",
        description: "Editing preferences have been updated successfully.",
      });
      setHasChanges(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (optionId: string, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [optionId]: {
        ...prev[optionId],
        isEnabled: enabled
      }
    }));
    setHasChanges(true);
  };

  const handleReset = () => {
    const initialPrefs: Record<string, { isEnabled: boolean; notes: string }> = {};
    detailedPreferences.forEach(pref => {
      initialPrefs[pref.id] = {
        isEnabled: pref.isEnabled,
        notes: pref.notes || ""
      };
    });
    setPreferences(initialPrefs);
    setGlobalNotes("");
    setHasChanges(false);
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  const enabledCount = detailedPreferences.filter(pref => preferences[pref.id]?.isEnabled).length;
  const totalCount = detailedPreferences.length;

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-20 bg-gray-200 rounded-2xl"></div>
      </div>
    );
  }

  if (detailedPreferences.length === 0) {
    return (
      <Card className="border-gray-200 shadow-sm rounded-2xl">
        <CardContent className="p-8 text-center">
          <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">
            No editing options available yet. Configure editing options in Settings first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="border-gray-200 shadow-sm rounded-2xl bg-white">
        <CollapsibleTrigger asChild>
          <CardHeader className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-rpp-red-lighter flex items-center justify-center">
                  <Settings className="w-6 h-6 text-rpp-red-main" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Editing Preferences</h3>
                  <p className="text-sm text-gray-600">
                    Automatic post-production edits applied to all {customerName || 'this customer'}'s photos
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-0 px-3 py-1 font-normal">
                  {enabledCount} active
                </Badge>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator className="bg-gray-200" />
          <CardContent className="p-6 space-y-6 bg-gray-50/30">
            {/* Automatic Edits Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-sm font-medium text-gray-700">Automatic Edits</Label>
                <span className="text-sm text-gray-500">
                  {enabledCount} of {totalCount} enabled
                </span>
              </div>

              {/* Editing Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {detailedPreferences.map((pref) => {
                  const IconComponent = getIconComponent(pref.icon);
                  const isEnabled = preferences[pref.id]?.isEnabled || false;
                  const colors = getIconColorClasses(pref.iconColor);

                  return (
                    <div
                      key={pref.id}
                      className={`group relative overflow-hidden rounded-xl border transition-all bg-white ${
                        isEnabled
                          ? 'border-[#f05a2a]/30 shadow-[0_0_0_3px_rgba(240,90,42,0.1)]'
                          : 'border-gray-200/60 hover:border-gray-300'
                      }`}
                      data-testid={`preference-option-${pref.id}`}
                    >
                      {/* Subtle gradient for enabled state */}
                      {isEnabled && (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#f05a2a]/[0.02] via-[#f05a2a]/[0.01] to-transparent pointer-events-none" />
                      )}
                      
                      <div className="relative p-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                            <IconComponent className={`w-6 h-6 ${pref.iconColor || 'text-gray-700'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-gray-900 truncate">{pref.name}</h4>
                            </div>
                            {pref.description && (
                              <p className="text-xs text-gray-600 leading-relaxed">
                                {pref.description}
                              </p>
                            )}
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleToggle(pref.id, checked)}
                            className="flex-shrink-0 data-[state=checked]:bg-rpp-red-main hover:data-[state=checked]:bg-rpp-red-dark data-[state=unchecked]:bg-gray-300 hover:data-[state=unchecked]:bg-gray-400 transition-colors bg-[#f05a2a]"
                            data-testid={`switch-${pref.id}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-gray-200" />

            {/* Notes for Editors */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-700" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="editor-notes" className="text-sm font-semibold text-gray-900 mb-1 block">
                    Notes for Editors
                  </Label>
                  <p className="text-xs text-gray-600 mb-3">
                    These instructions will be automatically included with every order for this client
                  </p>
                  <Textarea
                    id="editor-notes"
                    value={globalNotes}
                    onChange={(e) => {
                      setGlobalNotes(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Always brighten interiors and ensure all rooms are well-lit. Client prefers warm tones. Remove any visible power cords or cables from shots."
                    rows={3}
                    className="bg-white border-gray-200 text-sm resize-none focus:border-rpp-red-main focus:ring-rpp-red-main/20"
                    data-testid="textarea-global-notes"
                  />
                </div>
              </div>
            </div>

            {/* Info Tip */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Info className="w-4 h-4 text-blue-700" />
                </div>
                <p className="text-sm text-blue-800 leading-relaxed">
                  <span className="font-medium">Tip:</span> Be specific about style preferences, brightness levels, color tones, and any client-specific requirements to ensure consistent results.
                </p>
              </div>
            </div>

            {/* Footer with Status and Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-rpp-red-main"></div>
                <span className="text-gray-600 font-medium">
                  {enabledCount} automatic edits enabled{globalNotes ? ' + custom notes' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={!hasChanges}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl"
                  data-testid="button-reset-preferences"
                >
                  Reset to Defaults
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || saveMutation.isPending}
                  className="hover:bg-rpp-red-dark text-white rounded-xl shadow-sm bg-[#f05a2a]"
                  data-testid="button-save-preferences"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {saveMutation.isPending ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
