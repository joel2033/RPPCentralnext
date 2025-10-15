import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Sparkles, Trees, Cloud, Droplets, Palette, Sun, Image as ImageIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EditingOption {
  id: string;
  partnerId: string;
  name: string;
  description: string | null;
  icon: string | null;
  iconColor: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
}

const iconOptions = [
  { name: "Trees", icon: Trees, color: "bg-green-100 text-green-600" },
  { name: "Cloud", icon: Cloud, color: "bg-blue-100 text-blue-600" },
  { name: "Droplets", icon: Droplets, color: "bg-cyan-100 text-cyan-600" },
  { name: "Palette", icon: Palette, color: "bg-purple-100 text-purple-600" },
  { name: "Sun", icon: Sun, color: "bg-orange-100 text-orange-600" },
  { name: "Sparkles", icon: Sparkles, color: "bg-pink-100 text-pink-600" },
  { name: "ImageIcon", icon: ImageIcon, color: "bg-indigo-100 text-indigo-600" },
];

export default function EditingOptionsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: "Trees",
    iconColor: "bg-green-100 text-green-600",
  });

  const { data: options = [], isLoading } = useQuery<EditingOption[]>({
    queryKey: ["/api/editing-options"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; icon: string; iconColor: string }) => {
      return apiRequest("/api/editing-options", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/editing-options"] });
      toast({
        title: "Option Created",
        description: "Editing option has been created successfully.",
      });
      setIsAdding(false);
      setFormData({ name: "", description: "", icon: "Trees", iconColor: "bg-green-100 text-green-600" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create editing option. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; description: string; icon: string; iconColor: string }) => {
      return apiRequest(`/api/editing-options/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/editing-options"] });
      toast({
        title: "Option Updated",
        description: "Editing option has been updated successfully.",
      });
      setEditingId(null);
      setFormData({ name: "", description: "", icon: "Trees", iconColor: "bg-green-100 text-green-600" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update editing option. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/editing-options/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/editing-options"] });
      toast({
        title: "Option Deleted",
        description: "Editing option has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete editing option. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a name for the editing option.",
        variant: "destructive",
      });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (option: EditingOption) => {
    setEditingId(option.id);
    setFormData({
      name: option.name,
      description: option.description || "",
      icon: option.icon || "Trees",
      iconColor: option.iconColor || "bg-green-100 text-green-600",
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: "", description: "", icon: "Trees", iconColor: "bg-green-100 text-green-600" });
  };

  const getIconComponent = (iconName: string) => {
    const option = iconOptions.find(opt => opt.name === iconName);
    return option ? option.icon : Trees;
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-gray-200 rounded"></div>
        <div className="h-24 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add/Edit Form */}
      {isAdding && (
        <div className="border rounded-lg p-6 bg-gray-50">
          <h3 className="text-lg font-medium mb-4">{editingId ? "Edit" : "Add New"} Editing Option</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="option-name">Option Name *</Label>
              <Input
                id="option-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Grass Replacement, Sky Replacement"
                data-testid="input-option-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="option-description">Description</Label>
              <Textarea
                id="option-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Replace brown or patchy grass with lush green lawn"
                rows={3}
                data-testid="input-option-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-7 gap-2">
                {iconOptions.map((option) => {
                  const IconComponent = option.icon;
                  const isSelected = formData.icon === option.name;
                  return (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: option.name, iconColor: option.color })}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      data-testid={`button-icon-${option.name.toLowerCase()}`}
                    >
                      <div className={`w-10 h-10 rounded-full ${option.color} flex items-center justify-center mx-auto`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-option"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update Option" : "Add Option"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                data-testid="button-cancel-option"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Existing Options */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Available Editing Options ({options.length})</h3>
          {!isAdding && (
            <Button
              onClick={() => setIsAdding(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-add-new-option"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Option
            </Button>
          )}
        </div>

        {options.length === 0 && !isAdding ? (
          <div className="text-center py-12 border rounded-lg">
            <Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No Editing Options Yet</h3>
            <p className="text-gray-600 mb-6">
              Create editing options that can be applied to customer preferences
            </p>
            <Button
              onClick={() => setIsAdding(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-add-first-option"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Option
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {options.map((option) => {
              const IconComponent = getIconComponent(option.icon || "Trees");
              return (
                <div key={option.id} className="border rounded-lg p-4 bg-white" data-testid={`option-card-${option.id}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${option.iconColor} flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{option.name}</h4>
                        {option.description && (
                          <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(option)}
                      data-testid={`button-edit-${option.id}`}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete "${option.name}"? This will remove it from all customer preferences.`)) {
                          deleteMutation.mutate(option.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${option.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
