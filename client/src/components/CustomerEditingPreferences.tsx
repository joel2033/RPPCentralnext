import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, RotateCcw, Check, Settings2 } from "lucide-react";
import { Trees, Cloud, Droplets, Palette, Sun, Sparkles, Image as ImageIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  };
  return icons[iconName || "Settings2"] || Settings2;
};

export default function CustomerEditingPreferences({ customerId }: CustomerEditingPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
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
        preferences: preferencesToSave
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

  const handleNotesChange = (optionId: string, notes: string) => {
    setPreferences(prev => ({
      ...prev,
      [optionId]: {
        ...prev[optionId],
        notes
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
        <div className="h-20 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (detailedPreferences.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Settings2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 text-sm">
          No editing options available yet. Configure editing options in Settings first.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
        data-testid="button-toggle-preferences"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
            <Settings2 className="w-6 h-6 text-orange-600" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-gray-900">Editing Preferences</h3>
            <p className="text-sm text-gray-600">
              Automatic post-production edits applied to all this customer's photos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge className="bg-gray-100 text-gray-700 border-gray-200">
            {enabledCount} active
          </Badge>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Automatic Edits
              <span className="ml-2 text-gray-500 font-normal">
                {enabledCount} of {totalCount} enabled
              </span>
            </h4>

            {/* Editing Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {detailedPreferences.map((pref) => {
                const IconComponent = getIconComponent(pref.icon);
                const isEnabled = preferences[pref.id]?.isEnabled || false;

                return (
                  <div
                    key={pref.id}
                    className={`bg-white rounded-xl p-4 border-2 transition-all ${
                      isEnabled ? 'border-orange-200 bg-orange-50' : 'border-gray-200'
                    }`}
                    data-testid={`preference-option-${pref.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full ${pref.iconColor} flex items-center justify-center flex-shrink-0`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="font-semibold text-gray-900">{pref.name}</h5>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => handleToggle(pref.id, checked)}
                              data-testid={`switch-${pref.id}`}
                            />
                          </div>
                          {pref.description && (
                            <p className="text-sm text-gray-600 mb-2">{pref.description}</p>
                          )}
                          {isEnabled && (
                            <Textarea
                              value={preferences[pref.id]?.notes || ""}
                              onChange={(e) => handleNotesChange(pref.id, e.target.value)}
                              placeholder="Add specific instructions..."
                              rows={2}
                              className="text-sm mt-2"
                              data-testid={`textarea-notes-${pref.id}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes for Editors */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Settings2 className="w-4 h-4 text-blue-600" />
              </div>
              <h4 className="text-sm font-semibold text-gray-700">Notes for Editors</h4>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              These instructions will be automatically included with every order for this client
            </p>
            <Textarea
              value={globalNotes}
              onChange={(e) => {
                setGlobalNotes(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Always brighten interiors and ensure all rooms are well-lit. Client prefers warm tones. Remove any visible power cords or cables from shots."
              rows={3}
              className="bg-white"
              data-testid="textarea-global-notes"
            />
          </div>

          {/* Info Tip */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 text-xs font-bold">i</span>
              </div>
              <p className="text-sm text-blue-800">
                Tip: Be specific about style preferences, brightness levels, color tones, and any client-specific requirements to ensure consistent results.
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span className="text-gray-600">
                {enabledCount} automatic edits enabled{globalNotes ? ' + custom notes' : ''}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges}
              data-testid="button-reset-preferences"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              data-testid="button-save-preferences"
            >
              <Check className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
