import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Settings, Save, ChevronDown, ChevronRight } from "lucide-react";

interface CustomerDeliverySettingsProps {
  customerId: string;
  customerName: string;
  revisionLimitOverride: string | null;
}

export default function CustomerDeliverySettings({ 
  customerId, 
  customerName, 
  revisionLimitOverride 
}: CustomerDeliverySettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [overrideType, setOverrideType] = useState<"default" | "unlimited" | "custom">("default");
  const [customLimit, setCustomLimit] = useState(2);
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Initialize state from prop
  useEffect(() => {
    if (revisionLimitOverride === null || revisionLimitOverride === undefined) {
      setOverrideType("default");
    } else if (revisionLimitOverride === "unlimited") {
      setOverrideType("unlimited");
    } else {
      setOverrideType("custom");
      setCustomLimit(parseInt(revisionLimitOverride) || 2);
    }
    setHasChanges(false);
  }, [revisionLimitOverride]);

  const updateMutation = useMutation({
    mutationFn: async (data: { revisionLimitOverride: string | null }) => {
      return apiRequest(`/api/customers/${customerId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
      setHasChanges(false);
      toast({
        title: "Settings Saved",
        description: `Delivery settings for ${customerName} have been updated.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    let value: string | null = null;
    if (overrideType === "unlimited") {
      value = "unlimited";
    } else if (overrideType === "custom") {
      value = customLimit.toString();
    }
    updateMutation.mutate({ revisionLimitOverride: value });
  };

  const handleOverrideTypeChange = (value: "default" | "unlimited" | "custom") => {
    setOverrideType(value);
    setHasChanges(true);
  };

  const handleCustomLimitChange = (value: string) => {
    setCustomLimit(parseInt(value));
    setHasChanges(true);
  };

  // Get badge text based on current setting
  const getBadgeText = () => {
    if (overrideType === "default") return "Default";
    if (overrideType === "unlimited") return "Unlimited";
    return `${customLimit} rounds`;
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="border-gray-200 shadow-sm rounded-2xl bg-white">
        <CollapsibleTrigger asChild>
          <CardHeader className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-teal-100 text-teal-600">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-medium text-[18px] text-[#5c6165]">Revision Limits</h3>
                  <p className="text-sm text-gray-600">
                    Revision limits for {customerName || 'this customer'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-0 px-3 py-1 font-normal text-[14px]">
                  {getBadgeText()}
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
          <CardContent className="p-5 space-y-4 bg-gray-50/30">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">Revision Limit</Label>
              <RadioGroup
                value={overrideType}
                onValueChange={(value) => handleOverrideTypeChange(value as "default" | "unlimited" | "custom")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-2.5 rounded-lg border border-gray-200 hover:bg-white cursor-pointer bg-white">
                  <RadioGroupItem value="default" id="ds-default" />
                  <div className="flex-1">
                    <Label htmlFor="ds-default" className="font-medium cursor-pointer text-sm">Use default settings</Label>
                    <p className="text-xs text-gray-500">Apply your global revision limit settings</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-2.5 rounded-lg border border-gray-200 hover:bg-white cursor-pointer bg-white">
                  <RadioGroupItem value="unlimited" id="ds-unlimited" />
                  <div className="flex-1">
                    <Label htmlFor="ds-unlimited" className="font-medium cursor-pointer text-sm">Unlimited revisions</Label>
                    <p className="text-xs text-gray-500">No limit on revision requests</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-2.5 rounded-lg border border-gray-200 hover:bg-white bg-white">
                  <RadioGroupItem value="custom" id="ds-custom" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label htmlFor="ds-custom" className="font-medium cursor-pointer text-sm">Custom limit</Label>
                        <p className="text-xs text-gray-500">Set a specific limit</p>
                      </div>
                      {overrideType === "custom" && (
                        <Select
                          value={customLimit.toString()}
                          onValueChange={handleCustomLimitChange}
                        >
                          <SelectTrigger className="w-28 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 round</SelectItem>
                            <SelectItem value="2">2 rounds</SelectItem>
                            <SelectItem value="3">3 rounds</SelectItem>
                            <SelectItem value="4">4 rounds</SelectItem>
                            <SelectItem value="5">5 rounds</SelectItem>
                            <SelectItem value="6">6 rounds</SelectItem>
                            <SelectItem value="7">7 rounds</SelectItem>
                            <SelectItem value="8">8 rounds</SelectItem>
                            <SelectItem value="9">9 rounds</SelectItem>
                            <SelectItem value="10">10 rounds</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {hasChanges && (
              <div className="flex justify-end pt-3 border-t border-gray-200">
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  size="sm"
                  className="bg-[#f05a2a] hover:bg-[#d94820] text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
