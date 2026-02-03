import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface OrderService {
  id: string;
  name: string;
}

interface RequestRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  services: OrderService[];
  onSubmit: (data: RevisionRequestData) => Promise<void>;
  isSubmitting?: boolean;
}

export interface RevisionRequestData {
  serviceId: string | "all";
  reason: string;
  requestText: string;
}

const REVISION_REASONS = [
  { value: "quality_issues", label: "Quality Issues" },
  { value: "missing_requirements", label: "Missing Requirements" },
  { value: "incorrect_format", label: "Incorrect Format" },
  { value: "color_correction", label: "Color Correction Needed" },
  { value: "cropping_issues", label: "Cropping/Framing Issues" },
  { value: "object_removal", label: "Object Removal Incomplete" },
  { value: "other", label: "Other" },
];

const MAX_CHAR_LIMIT = 500;

export function RequestRevisionModal({
  isOpen,
  onClose,
  orderNumber,
  services,
  onSubmit,
  isSubmitting = false,
}: RequestRevisionModalProps) {
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [requestText, setRequestText] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubmit = async () => {
    setError("");

    // Validation
    if (!selectedService) {
      setError("Please select a service");
      return;
    }
    if (!selectedReason) {
      setError("Please select a reason");
      return;
    }
    if (!requestText.trim()) {
      setError("Please provide details for your revision request");
      return;
    }

    try {
      await onSubmit({
        serviceId: selectedService,
        reason: selectedReason,
        requestText: requestText.trim(),
      });
      
      // Reset form on success
      setSelectedService("");
      setSelectedReason("");
      setRequestText("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit revision request");
    }
  };

  const handleClose = () => {
    // Reset form state when closing
    setSelectedService("");
    setSelectedReason("");
    setRequestText("");
    setError("");
    onClose();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= MAX_CHAR_LIMIT) {
      setRequestText(text);
    }
  };

  const isValid = selectedService && selectedReason && requestText.trim();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold text-rpp-grey-darkest">
            Request a revision on order #{orderNumber}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 rounded-full absolute right-4 top-4"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <p className="text-sm text-rpp-grey mt-2">
          If not fully satisfied, request revisions directly from the supplier. For additional
          work, create a new order.
        </p>

        <div className="space-y-4 mt-4">
          {/* Service Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-rpp-grey-dark">
              Select the service you would like revised
            </Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select A Product Or Choose 'All'" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-rpp-grey-dark">
              Reason for your revision request
            </Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose A Reason Or Select Other" />
              </SelectTrigger>
              <SelectContent>
                {REVISION_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Request Text */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-rpp-grey-dark">
              Write your requests
            </Label>
            <div className="relative">
              <Textarea
                value={requestText}
                onChange={handleTextChange}
                placeholder="Provide some reasoning for your revision request"
                className="min-h-[120px] resize-none pr-12"
              />
              <span className="absolute bottom-2 right-2 text-xs text-rpp-grey">
                {requestText.length}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-semantic-red">{error}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-rpp-orange hover:text-rpp-orange hover:bg-rpp-orange-subtle"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="bg-rpp-grey-darkest text-white hover:bg-rpp-grey-dark"
          >
            {isSubmitting ? "Submitting..." : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { OrderService as RevisionOrderService };
