import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePickerPreset } from "@/components/ui/time-picker-preset";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { 
  X, 
  Clock, 
  Plus,
  Minus
} from "lucide-react";

interface EditAppointmentModalProps {
  appointment: any;
  onClose: () => void;
  onSave: () => void;
}

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

export default function EditAppointmentModal({ appointment, onClose, onSave }: EditAppointmentModalProps) {
  const [assignedOperators, setAssignedOperators] = useState<string[]>(appointment.assignedTo ? [appointment.assignedTo] : []);
  const [timezone, setTimezone] = useState("utc+10");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [manualDuration, setManualDuration] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [notes, setNotes] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Load products from appointment.products field (JSON string)
  useEffect(() => {
    console.log('[EditAppointmentModal] Loading products from appointment - products available:', !!appointment.products);
    
    if (!appointment.products || products.length === 0) {
      console.log('[EditAppointmentModal] Skipping - no appointment products or products list not loaded yet');
      return;
    }

    try {
      const storedProducts = typeof appointment.products === 'string' 
        ? JSON.parse(appointment.products) 
        : appointment.products;
      
      if (!Array.isArray(storedProducts) || storedProducts.length === 0) {
        console.log('[EditAppointmentModal] No products in appointment');
        return;
      }
      
      console.log('[EditAppointmentModal] Found stored products:', storedProducts);

      // Map stored products to SelectedProduct format
      const loadedProducts: SelectedProduct[] = [];
      
      for (const storedProduct of storedProducts) {
        const product = products.find(p => p.id === storedProduct.id);
        if (!product) continue; // Skip if product no longer exists

        // Check if product has variations and try to match by name
        let variationName: string | undefined = storedProduct.variationName;
        let productTitle = product.title;
        let productPrice = parseFloat(product.price);
        let duration = product.appointmentDuration || 60;

        if (product.hasVariations && product.variations && storedProduct.variationName) {
          const variations: ProductVariation[] = JSON.parse(product.variations);
          const matchingVariation = variations.find(v => v.name === storedProduct.variationName);

          if (matchingVariation) {
            variationName = matchingVariation.name;
            productTitle = `${product.title} - ${matchingVariation.name}`;
            productPrice = matchingVariation.noCharge ? 0 : Number(matchingVariation.price);
            duration = matchingVariation.appointmentDuration || duration;
          }
        }

        loadedProducts.push({
          id: product.id,
          title: productTitle,
          price: productPrice,
          quantity: storedProduct.quantity || 1,
          taxRate: parseFloat(product.taxRate),
          variationName,
          duration
        });
      }

      if (loadedProducts.length > 0) {
        setSelectedProducts(loadedProducts);
      }
    } catch (error) {
      console.error('[EditAppointmentModal] Error loading products from appointment:', error);
    }
  }, [appointment.products, products]);

  useEffect(() => {
    // Set initial values from appointment
    if (appointment.appointmentDate) {
      const date = new Date(appointment.appointmentDate);
      // Use local date formatting to avoid timezone shifts
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setAppointmentDate(`${year}-${month}-${day}`);
      
      // Get local time
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      setStartTime(`${hours}:${minutes}`);
    }
    if (appointment.notes) {
      setNotes(appointment.notes);
    }
    // Initialize duration from appointment's estimatedDuration
    if (appointment.estimatedDuration) {
      setDuration(appointment.estimatedDuration.toString());
    }
  }, [appointment]);

  // Calculate total duration from selected products
  const calculateTotalDuration = () => {
    return selectedProducts.reduce((total, product) => {
      return total + (product.duration || 60) * product.quantity;
    }, 0);
  };

  // Update duration when products change (if not manual)
  useEffect(() => {
    if (!manualDuration && selectedProducts.length > 0) {
      const totalDuration = calculateTotalDuration();
      setDuration(totalDuration.toString());
    } else if (!manualDuration && selectedProducts.length === 0 && appointment.estimatedDuration) {
      // If no products selected and manual duration is off, use the original estimated duration
      setDuration(appointment.estimatedDuration.toString());
    }
  }, [selectedProducts, manualDuration, appointment.estimatedDuration]);

  const handleAddProduct = (value: string) => {
    // Value format: "productId" or "productId:variationIndex"
    const [productId, variationIndex] = value.split(':');
    const product = products.find(p => p.id === productId);

    if (product) {
      let productTitle = product.title;
      let productPrice = parseFloat(product.price);
      let variationName: string | undefined;
      let duration = product.appointmentDuration || 60; // Default 60 minutes

      // Handle variation selection
      if (variationIndex !== undefined && product.variations) {
        const variations: ProductVariation[] = JSON.parse(product.variations);
        const variation = variations[parseInt(variationIndex)];

        if (variation) {
          productTitle = `${product.title} - ${variation.name}`;
          productPrice = variation.noCharge ? 0 : Number(variation.price);
          variationName = variation.name;
          duration = variation.appointmentDuration || duration;
        }
      }

      // Check if this exact product + variation combo already exists
      const existingProduct = selectedProducts.find(
        p => p.id === productId && p.variationName === variationName
      );

      if (existingProduct) {
        setSelectedProducts(prev =>
          prev.map(p =>
            p.id === productId && p.variationName === variationName
              ? { ...p, quantity: p.quantity + 1 }
              : p
          )
        );
      } else {
        setSelectedProducts(prev => [...prev, {
          id: productId,
          title: productTitle,
          price: productPrice,
          quantity: 1,
          taxRate: parseFloat(product.taxRate),
          variationName,
          duration
        }]);
      }
    }
  };

  const updateProductQuantity = (productId: string, variationName: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      setSelectedProducts(prev => prev.filter(p => !(p.id === productId && p.variationName === variationName)));
    } else {
      setSelectedProducts(prev =>
        prev.map(p => (p.id === productId && p.variationName === variationName) ? { ...p, quantity } : p)
      );
    }
  };

  const removeProduct = (productId: string, variationName: string | undefined) => {
    setSelectedProducts(prev => prev.filter(p => !(p.id === productId && p.variationName === variationName)));
  };

  const updateAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("You must be logged in to update appointments");
      }
      
      // Use the Firestore document ID (appointment.id) for the endpoint
      // The appointment.id is the Firestore document ID, which is what the API expects
      if (!appointment.id) {
        throw new Error("Appointment ID is missing");
      }
      const endpoint = `/api/appointments/${appointment.id}`;
      
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          ...appointmentData,
          // Include products in the update
          products: selectedProducts.map(p => ({
            id: p.id,
            name: p.title,
            quantity: p.quantity,
            variationName: p.variationName,
            price: p.price,
            duration: p.duration
          })),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update appointment");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", "*", "appointments"] });
      onSave();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update appointment",
        variant: "destructive",
      });
    },
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-support-green', 'bg-rpp-red-main', 'bg-support-blue', 'bg-support-yellow'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const appointmentDateTime = appointmentDate && startTime 
      ? `${appointmentDate}T${startTime}:00`
      : undefined;

    // Calculate estimated duration from selected products if not manually set
    let estimatedDuration = parseInt(duration) || 60;
    if (!manualDuration && selectedProducts.length > 0) {
      estimatedDuration = calculateTotalDuration();
    }

    const appointmentData = {
      appointmentDate: appointmentDateTime,
      assignedTo: assignedOperators.length > 0 ? assignedOperators[0] : undefined,
      notes: notes.trim() || undefined,
      estimatedDuration,
    };

    updateAppointmentMutation.mutate(appointmentData);
  };

  const selectOperator = (userId: string) => {
    // Set the selected operator (single selection)
    setAssignedOperators(userId ? [userId] : []);
  };

  const removeOperator = (userId: string) => {
    setAssignedOperators(prev => prev.filter(id => id !== userId));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Edit Appointment</DialogTitle>
          <DialogDescription className="text-sm text-rpp-grey-light">
            Modify details of your existing appointment below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Assign Operators */}
          <div className="space-y-2">
            <Label>Assign photographer</Label>
            {assignedOperators.length === 0 && (
              <p className="text-sm text-amber-600 mb-2">
                No photographer assigned. Select one below to assign this appointment.
              </p>
            )}
            <Select onValueChange={selectOperator} value={assignedOperators[0] || ""}>
              <SelectTrigger data-testid="select-assign-operators">
                <SelectValue placeholder="Select a photographer to assign" />
              </SelectTrigger>
              <SelectContent>
                {users.filter(user => user.role === 'photographer' || user.role === 'admin').map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Selected Operators */}
            {assignedOperators.length > 0 && (
              <div className="space-y-2">
                {assignedOperators.map((userId) => {
                  const user = users.find(u => u.id === userId);
                  if (!user) return null;
                  
                  return (
                    <div key={userId} className="flex items-center justify-between p-2 bg-gray-50 rounded" data-testid={`assigned-operator-${userId}`}>
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className={`${getAvatarColor(user.firstName)} text-white text-xs`}>
                            {getInitials(user.firstName, user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{user.firstName} {user.lastName}</span>
                        <Badge variant="outline" className="text-xs">{user.role}</Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOperator(userId)}
                        className="text-red-500 hover:text-red-700"
                        data-testid={`button-remove-operator-${userId}`}
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timezone and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
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
              />
            </div>
          </div>

          {/* Time and Duration */}
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
              <Label>Add duration</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => {
                    setDuration(e.target.value);
                    setManualDuration(true);
                  }}
                  className="w-20"
                  data-testid="input-duration"
                />
                <span className="text-sm text-rpp-grey-light">Minutes</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="manual-duration"
                  checked={manualDuration}
                  onChange={(e) => setManualDuration(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="manual-duration" className="text-xs text-muted-foreground cursor-pointer">
                  Manually set duration
                </label>
              </div>
              {!manualDuration && selectedProducts.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Auto-calculated from selected products
                </p>
              )}
            </div>
          </div>

          {/* Products */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Products</Label>
            </div>
            
            <Select onValueChange={handleAddProduct}>
              <SelectTrigger className="flex-1" data-testid="select-products">
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
                            {variation.name} - ${variation.noCharge ? '0.00' : Number(variation.price).toFixed(2)}
                            {variation.appointmentDuration && ` (${variation.appointmentDuration} min)`}
                          </SelectItem>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <SelectItem key={product.id} value={product.id}>
                      {product.title} - ${parseFloat(product.price).toFixed(2)}
                      {product.appointmentDuration && ` (${product.appointmentDuration} min)`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Selected Products */}
            {selectedProducts.length === 0 && (
              <p className="text-sm text-gray-500 italic">
                No products selected
              </p>
            )}

            {selectedProducts.length > 0 && (
              <div className="space-y-2">
                {selectedProducts.map((product, index) => (
                  <div
                    key={`${product.id}-${product.variationName || 'base'}`}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    data-testid={`selected-product-${index}`}
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
                          onClick={() => updateProductQuantity(product.id, product.variationName, product.quantity - 1)}
                          className="h-7 w-7 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{product.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateProductQuantity(product.id, product.variationName, product.quantity + 1)}
                          className="h-7 w-7 p-0"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(product.id, product.variationName)}
                        className="text-red-500 hover:text-red-700"
                        data-testid={`button-remove-product-${index}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Write Appointment Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Write appointment notes</Label>
            <p className="text-xs text-rpp-grey-light">
              Notes may be visible to customers if they are included as attendees on Google or Outlook Calendar events
            </p>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for this appointment..."
              rows={4}
              data-testid="textarea-appointment-notes"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateAppointmentMutation.isPending}
              className="bg-rpp-grey-dark hover:bg-rpp-grey-medium text-white"
              data-testid="button-save-appointment"
            >
              {updateAppointmentMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}