import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePickerPreset } from "@/components/ui/time-picker-preset";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { Clock } from "lucide-react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface ProductVariation {
  name: string;
  price: number;
  appointmentDuration?: number;
  noCharge?: boolean;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  taxRate: string;
  type: string;
  category: string;
  hasVariations?: boolean;
  variations?: string; // JSON string
  appointmentDuration?: number;
}

interface SelectedProduct {
  id: string;
  title: string;
  price: number;
  quantity: number;
  taxRate: number;
  variationName?: string;
  duration?: number; // in minutes
}

interface CreateAppointmentModalProps {
  jobId: string; // Public jobId (NanoID) used in /api/jobs/:jobId/appointments
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateAppointmentModal({ jobId, onClose, onCreated }: CreateAppointmentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [appointmentDate, setAppointmentDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [manualDuration, setManualDuration] = useState(false);
  // Use a sentinel value for "unassigned" so Select.Item value is never an empty string
  const [assignedTo, setAssignedTo] = useState<string>("unassigned");
  const [notes, setNotes] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const handleAddProduct = (value: string) => {
    // Value format: "productId" or "productId:variationIndex"
    const [productId, variationIndex] = value.split(":");
    const product = products.find((p) => p.id === productId);

    if (!product) return;

    let productTitle = product.title;
    let productPrice = parseFloat(product.price);
    let variationName: string | undefined;
    let appointmentDuration = product.appointmentDuration || 60;

    if (variationIndex !== undefined && product.variations) {
      const variations: ProductVariation[] = JSON.parse(product.variations);
      const variation = variations[parseInt(variationIndex)];
      if (variation) {
        productTitle = `${product.title} - ${variation.name}`;
        productPrice = variation.noCharge ? 0 : Number(variation.price);
        variationName = variation.name;
        appointmentDuration = variation.appointmentDuration || appointmentDuration;
      }
    }

    const existing = selectedProducts.find(
      (p) => p.id === productId && p.variationName === variationName
    );

    if (existing) {
      setSelectedProducts((prev) =>
        prev.map((p) =>
          p.id === productId && p.variationName === variationName
            ? { ...p, quantity: p.quantity + 1 }
            : p
        )
      );
    } else {
      setSelectedProducts((prev) => [
        ...prev,
        {
          id: productId,
          title: productTitle,
          price: productPrice,
          quantity: 1,
          taxRate: parseFloat(product.taxRate),
          variationName,
          duration: appointmentDuration,
        },
      ]);
    }
  };

  const updateProductQuantity = (
    productId: string,
    variationName: string | undefined,
    quantity: number
  ) => {
    if (quantity <= 0) {
      setSelectedProducts((prev) =>
        prev.filter((p) => !(p.id === productId && p.variationName === variationName))
      );
    } else {
      setSelectedProducts((prev) =>
        prev.map((p) =>
          p.id === productId && p.variationName === variationName
            ? { ...p, quantity }
            : p
        )
      );
    }
  };

  const calculateTotalDurationFromProducts = () => {
    if (selectedProducts.length === 0) return null;
    return selectedProducts.reduce((total, p) => {
      return total + (p.duration || 60) * p.quantity;
    }, 0);
  };

  // Keep duration in sync with products when not manually overridden
  useEffect(() => {
    if (!manualDuration) {
      const total = calculateTotalDurationFromProducts();
      if (total && !Number.isNaN(total)) {
        setDuration(total.toString());
      }
    }
  }, [selectedProducts, manualDuration]);

  const createAppointmentMutation = useMutation({
    mutationFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("You must be logged in to create appointments");
      }

      if (!appointmentDate || !startTime) {
        throw new Error("Please select a date and start time");
      }

      const appointmentDateTime = `${appointmentDate}T${startTime}:00`;

      // If products are selected and user hasn't manually overridden duration, derive from products
      let estimatedDuration = parseInt(duration) || 60;
      if (!manualDuration) {
        const productsDuration = calculateTotalDurationFromProducts();
        if (productsDuration && !Number.isNaN(productsDuration)) {
          estimatedDuration = productsDuration;
        }
      }

      const response = await fetch(`/api/jobs/${jobId}/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          appointmentDate: appointmentDateTime,
          estimatedDuration,
          assignedTo: assignedTo === "unassigned" ? undefined : assignedTo,
          notes: notes.trim() || undefined,
          products:
            selectedProducts.length > 0
              ? selectedProducts.map((p) => ({
                  id: p.id,
                  name: p.title,
                  quantity: p.quantity,
                  variationName: p.variationName,
                  price: p.price,
                  duration: p.duration,
                }))
              : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create appointment");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Appointment created",
        description: "A new appointment has been scheduled for this job.",
      });
      // Refresh job card and appointments
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/card", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "appointments"] });
      onCreated();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create appointment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createAppointmentMutation.isPending) return;
    createAppointmentMutation.mutate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Schedule New Appointment</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Create an additional appointment for this job.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Assign operator/photographer */}
          <div className="space-y-2">
            <Label>Assign operator(s)</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select photographer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date and timezone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select defaultValue="utc+10">
                <SelectTrigger data-testid="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utc+10">(UTC+10:00) Canberra...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Select a day</Label>
              <DatePicker
                value={appointmentDate}
                onChange={setAppointmentDate}
                minDate={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          {/* Time and duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Set a start time</Label>
              <TimePickerPreset
                value={startTime}
                onChange={setStartTime}
                interval={5}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <Label>Duration</Label>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <input
                    id="manual-duration"
                    type="checkbox"
                    className="w-3.5 h-3.5"
                    checked={manualDuration}
                    onChange={(e) => setManualDuration(e.target.checked)}
                  />
                  <label htmlFor="manual-duration" className="cursor-pointer">
                    Manual override
                  </label>
                </div>
              </div>
              <Input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  setManualDuration(true);
                }}
                disabled={!manualDuration}
              />
              {!manualDuration && selectedProducts.length > 0 && (
                <p className="text-xs text-gray-500">
                  Auto-calculated from selected products
                </p>
              )}
            </div>
          </div>

          {/* Products */}
          <div className="space-y-2">
            <Label>Products (optional)</Label>
            <Select onValueChange={handleAddProduct}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a product to add" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => {
                  if (product.hasVariations && product.variations) {
                    const variations: ProductVariation[] = JSON.parse(product.variations);
                    return (
                      <div key={product.id}>
                        <div className="px-2 py-1.5 text-sm font-semibold text-gray-700">
                          {product.title}
                        </div>
                        {variations.map((variation, index) => (
                          <SelectItem
                            key={`${product.id}:${index}`}
                            value={`${product.id}:${index}`}
                            className="pl-6"
                          >
                            {variation.name} - $
                            {variation.noCharge
                              ? "0.00"
                              : Number(variation.price).toFixed(2)}
                            {variation.appointmentDuration &&
                              ` (${variation.appointmentDuration} min)`}
                          </SelectItem>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <SelectItem key={product.id} value={product.id}>
                      {product.title} - ${parseFloat(product.price).toFixed(2)}
                      {product.appointmentDuration &&
                        ` (${product.appointmentDuration} min)`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Selected products */}
            {selectedProducts.length > 0 && (
              <div className="space-y-2 mt-2">
                {selectedProducts.map((product, index) => (
                  <div
                    key={`${product.id}-${product.variationName || "base"}-${index}`}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{product.title}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>${product.price.toFixed(2)}</span>
                        {product.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{product.duration * product.quantity} min</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center space-x-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateProductQuantity(
                              product.id,
                              product.variationName,
                              product.quantity - 1
                            )
                          }
                          className="h-7 w-7 p-0"
                        >
                          -
                        </Button>
                        <span className="w-8 text-center text-sm">
                          {product.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateProductQuantity(
                              product.id,
                              product.variationName,
                              product.quantity + 1
                            )
                          }
                          className="h-7 w-7 p-0"
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any special instructions for this appointment..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#f2572c] hover:bg-[#d94820] text-white"
              disabled={createAppointmentMutation.isPending}
            >
              {createAppointmentMutation.isPending ? "Scheduling..." : "Schedule Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


