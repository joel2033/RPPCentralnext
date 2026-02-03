import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Users,
  Palette,
  Pentagon,
  Save,
  Loader2,
  Info,
  MousePointer,
} from "lucide-react";

// Extend Window interface for Google Maps
declare global {
  interface Window {
    google: any;
    initServiceAreasMap: () => void;
  }
}

interface ServiceArea {
  id: string;
  name: string;
  polygon: {
    type: string;
    coordinates: [number, number][][];
  } | null;
  color: string;
  isActive: boolean;
  assignedOperators: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImage?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profileImage?: string;
}

// Predefined colors for service areas
const AREA_COLORS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Orange", value: "#F97316" },
  { name: "Green", value: "#22C55E" },
  { name: "Purple", value: "#A855F7" },
  { name: "Pink", value: "#EC4899" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Yellow", value: "#EAB308" },
  { name: "Red", value: "#EF4444" },
];

export default function ServiceAreasManager() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Map refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const drawingManagerRef = useRef<any>(null);
  const polygonsRef = useRef<Map<string, any>>(new Map());
  const currentPolygonRef = useRef<any>(null);

  // State
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [selectedArea, setSelectedArea] = useState<ServiceArea | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaColor, setNewAreaColor] = useState(AREA_COLORS[0].value);
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [pendingPolygonCoords, setPendingPolygonCoords] = useState<[number, number][] | null>(null);

  // Fetch service areas
  const { data: serviceAreas = [], isLoading: areasLoading } = useQuery<ServiceArea[]>({
    queryKey: ["/api/service-areas"],
  });

  // Fetch team members for operator assignment
  const { data: teamMembers = [], isLoading: teamLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/users"],
  });

  // Create service area mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; polygon: any; color: string; assignedOperatorIds: string[] }) => {
      return apiRequest("/api/service-areas", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-areas"] });
      toast({ title: "Success", description: "Service area created successfully" });
      resetNewAreaState();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create service area", variant: "destructive" });
    },
  });

  // Update service area mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceArea> & { assignedOperatorIds?: string[] } }) => {
      return apiRequest(`/api/service-areas/${id}`, "PATCH", data);
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/service-areas"] });
      
      // Snapshot the previous value
      const previousServiceAreas = queryClient.getQueryData<ServiceArea[]>(["/api/service-areas"]);
      
      // Optimistically update the cache
      queryClient.setQueryData<ServiceArea[]>(["/api/service-areas"], (old) =>
        old?.map((area) =>
          area.id === id ? { ...area, ...data } : area
        )
      );
      
      // Also update selectedArea if it's the one being updated
      if (selectedArea?.id === id) {
        setSelectedArea((prev) => prev ? { ...prev, ...data } : null);
      }
      
      return { previousServiceAreas };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-areas"] });
      // Only show toast and close dialog for non-toggle updates (when editing)
      if (isEditDialogOpen) {
        toast({ title: "Success", description: "Service area updated successfully" });
        setIsEditDialogOpen(false);
        setSelectedArea(null);
      }
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousServiceAreas) {
        queryClient.setQueryData(["/api/service-areas"], context.previousServiceAreas);
      }
      
      // Restore selectedArea if it was updated
      if (selectedArea?.id === variables.id) {
        const previousArea = context?.previousServiceAreas?.find(a => a.id === variables.id);
        if (previousArea) {
          setSelectedArea(previousArea);
        }
      }
      
      toast({ title: "Error", description: error.message || "Failed to update service area", variant: "destructive" });
    },
    onSettled: () => {
      // Always refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["/api/service-areas"] });
    },
  });

  // Delete service area mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/service-areas/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-areas"] });
      toast({ title: "Success", description: "Service area deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSelectedArea(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete service area", variant: "destructive" });
    },
  });

  // Reset new area state
  const resetNewAreaState = useCallback(() => {
    setIsCreatingNew(false);
    setIsDrawingMode(false);
    setNewAreaName("");
    setNewAreaColor(AREA_COLORS[0].value);
    setSelectedOperators([]);
    setPendingPolygonCoords(null);
    if (currentPolygonRef.current) {
      currentPolygonRef.current.setMap(null);
      currentPolygonRef.current = null;
    }
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null);
    }
  }, []);

  // Initialize Google Maps
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    if (!apiKey) {
      console.error("Google Maps API key not configured");
      return;
    }

    // Define global callback
    window.initServiceAreasMap = () => {
      if (!mapRef.current) return;

      // Initialize map centered on NSW, Australia (based on screenshot)
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: -33.4, lng: 151.2 }, // Central Coast area
        zoom: 8,
        mapTypeId: "roadmap",
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: window.google.maps.ControlPosition.TOP_RIGHT,
        },
        fullscreenControl: true,
        streetViewControl: false,
        zoomControl: true,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_CENTER,
        },
      });

      mapInstanceRef.current = map;

      // Initialize Drawing Manager
      const drawingManager = new window.google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false, // We'll use our own controls
        polygonOptions: {
          fillColor: AREA_COLORS[0].value,
          fillOpacity: 0.35,
          strokeWeight: 2,
          strokeColor: AREA_COLORS[0].value,
          clickable: true,
          editable: true,
          zIndex: 1,
        },
      });

      drawingManager.setMap(map);
      drawingManagerRef.current = drawingManager;

      // Listen for polygon complete
      window.google.maps.event.addListener(drawingManager, "polygoncomplete", (polygon: any) => {
        // Get coordinates from the polygon
        const path = polygon.getPath();
        const coordinates: [number, number][] = [];
        
        for (let i = 0; i < path.getLength(); i++) {
          const point = path.getAt(i);
          coordinates.push([point.lng(), point.lat()]); // GeoJSON uses [lng, lat]
        }
        
        // Close the polygon
        if (coordinates.length > 0) {
          coordinates.push(coordinates[0]);
        }

        // Store the polygon reference and coordinates
        currentPolygonRef.current = polygon;
        setPendingPolygonCoords(coordinates);
        
        // Exit drawing mode
        drawingManager.setDrawingMode(null);
        setIsDrawingMode(false);
        setIsCreatingNew(true);
      });

      setIsMapLoaded(true);
    };

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps && window.google.maps.drawing) {
      window.initServiceAreasMap();
    } else {
      // Load Google Maps script with drawing library
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,places&callback=initServiceAreasMap`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
    }
  }, []);

  // Draw existing service areas on the map
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    // Clear existing polygons
    polygonsRef.current.forEach((polygon) => polygon.setMap(null));
    polygonsRef.current.clear();

    // Draw each service area
    serviceAreas.forEach((area) => {
      if (!area.polygon || !area.polygon.coordinates?.[0]) return;

      const coordinates = area.polygon.coordinates[0];
      const path = coordinates.map(([lng, lat]) => ({ lat, lng }));

      const polygon = new window.google.maps.Polygon({
        paths: path,
        fillColor: area.color,
        fillOpacity: 0.35,
        strokeWeight: 2,
        strokeColor: area.color,
        clickable: true,
        editable: false,
        map: mapInstanceRef.current,
      });

      // Add click listener to select the area
      polygon.addListener("click", () => {
        setSelectedArea(area);
        setSelectedOperators(area.assignedOperators.map((op) => op.id));
      });

      polygonsRef.current.set(area.id, polygon);
    });

    // Fit bounds to show all areas
    if (serviceAreas.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      serviceAreas.forEach((area) => {
        if (area.polygon?.coordinates?.[0]) {
          area.polygon.coordinates[0].forEach(([lng, lat]) => {
            bounds.extend({ lat, lng });
          });
        }
      });
      mapInstanceRef.current.fitBounds(bounds, 50);
    }
  }, [isMapLoaded, serviceAreas]);

  // Update polygon color when newAreaColor changes
  useEffect(() => {
    if (currentPolygonRef.current && newAreaColor) {
      currentPolygonRef.current.setOptions({
        fillColor: newAreaColor,
        strokeColor: newAreaColor,
      });
    }
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setOptions({
        polygonOptions: {
          fillColor: newAreaColor,
          fillOpacity: 0.35,
          strokeWeight: 2,
          strokeColor: newAreaColor,
          clickable: true,
          editable: true,
          zIndex: 1,
        },
      });
    }
  }, [newAreaColor]);

  // Handle start drawing
  const handleStartDrawing = () => {
    if (!drawingManagerRef.current || !isMapLoaded) {
      toast({ 
        title: "Map Loading", 
        description: "Please wait for the map to finish loading", 
        variant: "default" 
      });
      return;
    }
    
    resetNewAreaState();
    setIsDrawingMode(true);
    drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
  };

  // Handle save new area
  const handleSaveNewArea = () => {
    if (!newAreaName.trim()) {
      toast({ title: "Error", description: "Please enter a name for the service area", variant: "destructive" });
      return;
    }

    if (!pendingPolygonCoords || pendingPolygonCoords.length < 4) {
      toast({ title: "Error", description: "Please draw a valid polygon on the map", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      name: newAreaName.trim(),
      polygon: {
        type: "Polygon",
        coordinates: [pendingPolygonCoords],
      },
      color: newAreaColor,
      assignedOperatorIds: selectedOperators,
    });
  };

  // Handle edit area
  const handleEditArea = () => {
    if (!selectedArea) return;

    updateMutation.mutate({
      id: selectedArea.id,
      data: {
        name: selectedArea.name,
        color: selectedArea.color,
        assignedOperatorIds: selectedOperators,
      },
    });
  };

  // Handle operator toggle
  const handleOperatorToggle = (operatorId: string) => {
    setSelectedOperators((prev) =>
      prev.includes(operatorId)
        ? prev.filter((id) => id !== operatorId)
        : [...prev, operatorId]
    );
  };

  // Highlight selected area on map
  useEffect(() => {
    polygonsRef.current.forEach((polygon, areaId) => {
      const area = serviceAreas.find((a) => a.id === areaId);
      if (!area) return;

      if (selectedArea?.id === areaId) {
        polygon.setOptions({
          strokeWeight: 4,
          fillOpacity: 0.5,
        });
      } else {
        polygon.setOptions({
          strokeWeight: 2,
          fillOpacity: 0.35,
        });
      }
    });
  }, [selectedArea, serviceAreas]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Service Areas List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold">Service Areas</h3>
          <Button
            size="sm"
            onClick={handleStartDrawing}
            disabled={!isMapLoaded || isDrawingMode || isCreatingNew}
            className="flex-shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Area
          </Button>
        </div>

        {/* Instructions when drawing */}
        {isDrawingMode && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Drawing Mode Active</p>
                  <p>Click on the map to place points. Click the first point again to close the polygon.</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={resetNewAreaState}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel Drawing
              </Button>
            </CardContent>
          </Card>
        )}

        {/* New Area Form */}
        {isCreatingNew && pendingPolygonCoords && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-green-800">
                <Pentagon className="w-5 h-5" />
                <span className="font-medium">New Service Area</span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="areaName">Area Name</Label>
                <Input
                  id="areaName"
                  placeholder="e.g., Newcastle, Central Coast"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {AREA_COLORS.map((color) => (
                    <button
                      key={color.value}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        newAreaColor === color.value
                          ? "border-gray-900 scale-110"
                          : "border-transparent hover:border-gray-400"
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setNewAreaColor(color.value)}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign Operators</Label>
                <ScrollArea className="h-32 border rounded-md p-2">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 py-1.5"
                    >
                      <Checkbox
                        id={`new-op-${member.id}`}
                        checked={selectedOperators.includes(member.id)}
                        onCheckedChange={() => handleOperatorToggle(member.id)}
                      />
                      <label
                        htmlFor={`new-op-${member.id}`}
                        className="flex items-center gap-2 cursor-pointer flex-1"
                      >
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={member.profileImage} />
                          <AvatarFallback className="text-xs">
                            {member.firstName?.[0]}{member.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {member.firstName} {member.lastName}
                        </span>
                      </label>
                    </div>
                  ))}
                  {teamMembers.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No team members available
                    </p>
                  )}
                </ScrollArea>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={resetNewAreaState}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveNewArea}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Save Area
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Areas List */}
        <ScrollArea className="h-[400px]">
          {areasLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : serviceAreas.length === 0 && !isCreatingNew ? (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-2">No service areas defined</p>
              <p className="text-sm text-gray-400">
                Click "Add Area" to draw your first service area
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {serviceAreas.map((area) => (
                <Card
                  key={area.id}
                  className={`cursor-pointer transition-all ${
                    selectedArea?.id === area.id
                      ? "ring-2 ring-primary"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setSelectedArea(area);
                    setSelectedOperators(area.assignedOperators.map((op) => op.id));
                    
                    // Pan to the area on the map
                    if (mapInstanceRef.current && area.polygon?.coordinates?.[0]) {
                      const bounds = new window.google.maps.LatLngBounds();
                      area.polygon.coordinates[0].forEach(([lng, lat]) => {
                        bounds.extend({ lat, lng });
                      });
                      mapInstanceRef.current.fitBounds(bounds, 50);
                    }
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: area.color }}
                        />
                        <div>
                          <h4 className="font-medium">{area.name}</h4>
                          <div className="flex items-center gap-1 mt-1">
                            <Users className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {area.assignedOperators.length} operator{area.assignedOperators.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={area.isActive}
                        onCheckedChange={(checked) => {
                          updateMutation.mutate({
                            id: area.id,
                            data: { isActive: checked },
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    {/* Assigned Operators */}
                    {area.assignedOperators.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {area.assignedOperators.slice(0, 3).map((op) => (
                          <Avatar key={op.id} className="w-6 h-6 border-2 border-white">
                            <AvatarImage src={op.profileImage} />
                            <AvatarFallback className="text-xs">
                              {op.firstName?.[0]}{op.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {area.assignedOperators.length > 3 && (
                          <span className="text-xs text-gray-500 flex items-center">
                            +{area.assignedOperators.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Selected Area Actions */}
        {selectedArea && !isCreatingNew && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsEditDialogOpen(true)}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="lg:col-span-2">
        <Card className="h-[600px] overflow-hidden">
          <div ref={mapRef} className="w-full h-full" />
          {!isMapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Loading map...</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Service Area</DialogTitle>
            <DialogDescription>
              Update the service area details and operator assignments.
            </DialogDescription>
          </DialogHeader>
          
          {selectedArea && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Area Name</Label>
                <Input
                  id="editName"
                  value={selectedArea.name}
                  onChange={(e) =>
                    setSelectedArea({ ...selectedArea, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {AREA_COLORS.map((color) => (
                    <button
                      key={color.value}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        selectedArea.color === color.value
                          ? "border-gray-900 scale-110"
                          : "border-transparent hover:border-gray-400"
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() =>
                        setSelectedArea({ ...selectedArea, color: color.value })
                      }
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign Operators</Label>
                <ScrollArea className="h-40 border rounded-md p-2">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 py-1.5"
                    >
                      <Checkbox
                        id={`edit-op-${member.id}`}
                        checked={selectedOperators.includes(member.id)}
                        onCheckedChange={() => handleOperatorToggle(member.id)}
                      />
                      <label
                        htmlFor={`edit-op-${member.id}`}
                        className="flex items-center gap-2 cursor-pointer flex-1"
                      >
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={member.profileImage} />
                          <AvatarFallback className="text-xs">
                            {member.firstName?.[0]}{member.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {member.firstName} {member.lastName}
                        </span>
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditArea} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-1" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Area</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedArea?.name}"? This action cannot be undone.
              Bookings may no longer be validated against this area.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => selectedArea && deleteMutation.mutate(selectedArea.id)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

