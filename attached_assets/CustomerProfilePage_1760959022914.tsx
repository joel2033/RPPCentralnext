import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { 
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  Building2,
  ChevronDown,
  MapPin,
  Calendar,
  DollarSign,
  Sparkles,
  Flame,
  Cloud,
  TreePine,
  Sun,
  Droplets,
  Palette,
  Image as ImageIcon,
  Settings,
  Check,
  ChevronRight,
  FileText,
  Info,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface CustomerProfilePageProps {
  customer: {
    id: string;
    name: string;
    company: string;
    email: string;
    phone: string;
    totalValue: number;
    averageJobValue: number;
    jobsCompleted: number;
    avatar: string;
    avatarColor: string;
    category?: string;
    notes?: string;
  };
  onBack: () => void;
}

interface Job {
  id: string;
  address: string;
  startDate: string;
  dueDate: string;
  status: 'Completed' | 'In Progress' | 'Scheduled' | 'Cancelled';
  amount: number;
}

const mockJobs: Job[] = [
  {
    id: '1',
    address: '16 Collins Street, Plumpton NSW 6018 2761',
    startDate: 'Aug 07, 2025',
    dueDate: 'Aug 09',
    status: 'Completed',
    amount: 380.00,
  },
  {
    id: '2',
    address: '42 Martin Place, Sydney NSW 2000',
    startDate: 'Aug 10, 2025',
    dueDate: 'Aug 12',
    status: 'In Progress',
    amount: 520.00,
  },
  {
    id: '3',
    address: '18 Beach Road, Bondi NSW 2026',
    startDate: 'Aug 14, 2025',
    dueDate: 'Aug 16',
    status: 'Scheduled',
    amount: 450.00,
  },
];

const editingPreferences = [
  {
    id: 'grass-replacement',
    name: 'Grass Replacement',
    description: 'Replace brown or patchy grass with lush green lawn',
    icon: TreePine,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    enabled: true,
  },
  {
    id: 'add-fire',
    name: 'Add Fire to Fireplaces',
    description: 'Add realistic flames to fireplace photos',
    icon: Flame,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    enabled: true,
  },
  {
    id: 'sky-replacement',
    name: 'Sky Replacement',
    description: 'Replace dull or overcast skies with blue skies',
    icon: Cloud,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    enabled: true,
  },
  {
    id: 'brighten-photos',
    name: 'Brighten Dark Photos',
    description: 'Automatically brighten underexposed images',
    icon: Sun,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    enabled: false,
  },
  {
    id: 'pool-enhancement',
    name: 'Pool Water Enhancement',
    description: 'Make pool water appear more blue and inviting',
    icon: Droplets,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    enabled: true,
  },
  {
    id: 'color-correction',
    name: 'Auto Color Correction',
    description: 'Balance colors and white balance automatically',
    icon: Palette,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    enabled: true,
  },
  {
    id: 'remove-clutter',
    name: 'Remove Small Objects',
    description: 'Remove bins, cords, and other small clutter',
    icon: Sparkles,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    enabled: false,
  },
  {
    id: 'enhance-windows',
    name: 'Window View Enhancement',
    description: 'Improve views visible through windows',
    icon: ImageIcon,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    enabled: false,
  },
];

export function CustomerProfilePage({ customer, onBack }: CustomerProfilePageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [preferences, setPreferences] = useState(editingPreferences);
  const [preferencesOpen, setPreferencesOpen] = useState(true);
  const [editorNotes, setEditorNotes] = useState('Always brighten interiors and ensure all rooms are well-lit. Client prefers warm tones. Remove any visible power cords or cables from shots.');
  
  const filteredJobs = mockJobs.filter(job =>
    job.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTogglePreference = (id: string) => {
    setPreferences(preferences.map(pref => 
      pref.id === id ? { ...pref, enabled: !pref.enabled } : pref
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'In Progress':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Scheduled':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-xl hover:bg-accent"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1>{customer.name}</h1>
            </div>
            <p className="text-muted-foreground text-sm">Customer Profile</p>
          </div>
        </div>
        <Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 rounded-xl h-9 px-5 text-sm">
          <Plus className="w-4 h-4 mr-2" />
          Create new job
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-border/50 shadow-sm rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-2xl text-primary mb-1">${customer.totalValue}</p>
                <p className="text-xs text-muted-foreground">Total Sales</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-2xl text-primary mb-1">${customer.averageJobValue}</p>
                <p className="text-xs text-muted-foreground">Average Job Value</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-2xl text-primary mb-1">{customer.jobsCompleted}</p>
                <p className="text-xs text-muted-foreground">Jobs Completed</p>
              </CardContent>
            </Card>
          </div>

          {/* Editing Preferences */}
          <Collapsible open={preferencesOpen} onOpenChange={setPreferencesOpen}>
            <Card className="border-border/50 shadow-sm rounded-2xl">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 ring-1 ring-primary/20 shadow-sm flex items-center justify-center">
                        <Settings className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Editing Preferences</CardTitle>
                        <CardDescription className="text-xs">
                          Automatic post-production edits applied to all {customer.name}'s photos
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs px-2.5 py-1 bg-muted text-muted-foreground border-border">
                        {preferences.filter(p => p.enabled).length} active
                      </Badge>
                      <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${preferencesOpen ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-5">
                  {/* Preferences Grid */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm">Automatic Edits</Label>
                      <span className="text-xs text-muted-foreground">
                        {preferences.filter(p => p.enabled).length} of {preferences.length} enabled
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {preferences.map((preference) => {
                        const Icon = preference.icon;
                        return (
                          <div
                            key={preference.id}
                            className={`group relative overflow-hidden rounded-xl border transition-all ${
                              preference.enabled
                                ? 'border-primary/40 bg-white shadow-sm'
                                : 'border-border/50 bg-muted/30 hover:border-border'
                            }`}
                          >
                            {/* Background gradient for enabled state */}
                            {preference.enabled && (
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-primary/[0.03] to-transparent pointer-events-none" />
                            )}
                            
                            <div className="relative p-3.5">
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg ${preference.bgColor} flex items-center justify-center flex-shrink-0`}>
                                  <Icon className={`w-5 h-5 ${preference.color}`} />
                                </div>
                                <div className="flex-1 min-w-0 pt-0.5">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-medium truncate">{preference.name}</h4>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {preference.description}
                                  </p>
                                </div>
                                <Switch
                                  checked={preference.enabled}
                                  onCheckedChange={() => handleTogglePreference(preference.id)}
                                  className="data-[state=checked]:bg-primary mt-1 flex-shrink-0"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Editor Notes */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="editor-notes" className="text-sm mb-1 block">
                          Notes for Editors
                        </Label>
                        <p className="text-xs text-muted-foreground mb-3">
                          These instructions will be automatically included with every order for this client
                        </p>
                      </div>
                    </div>
                    <Textarea
                      id="editor-notes"
                      value={editorNotes}
                      onChange={(e) => setEditorNotes(e.target.value)}
                      placeholder="Add specific editing instructions, style preferences, or requirements that editors should follow for this client's orders..."
                      className="min-h-[120px] rounded-xl resize-none bg-background border-border/50 focus:border-primary/50 transition-colors"
                    />
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-900">
                        <span className="font-medium">Tip:</span> Be specific about style preferences, brightness levels, color tones, and any client-specific requirements to ensure consistent results.
                      </p>
                    </div>
                  </div>

              <Separator />

              {/* Summary and Actions */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-muted-foreground">
                    {preferences.filter(p => p.enabled).length > 0 ? (
                      <>
                        {preferences.filter(p => p.enabled).length} automatic edit{preferences.filter(p => p.enabled).length > 1 ? 's' : ''} enabled
                        {editorNotes.trim() && ' + custom notes'}
                      </>
                    ) : (
                      'No preferences configured'
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-9 px-4 text-sm border-border/50"
                  >
                    Reset to Defaults
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-primary to-primary/90 rounded-xl h-9 px-6 text-sm shadow-sm"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Save Preferences
                  </Button>
                </div>
              </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Jobs Section */}
          <Card className="border-border/50 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Jobs</CardTitle>
                  <CardDescription className="text-xs">
                    Easily access and manage upcoming and delivered jobs for this customer.
                  </CardDescription>
                </div>
                <Button
                  variant="link"
                  className="text-primary text-sm h-auto p-0"
                >
                  + Create new job
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Search and Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs by address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 rounded-xl border-border/50 bg-background text-sm"
                  />
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="rounded-xl border-border/50 hover:border-primary/50 h-9 px-4 text-sm gap-2"
                    >
                      {statusFilter}
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setStatusFilter('All Status')}>
                      All Status
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('Completed')}>
                      Completed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('In Progress')}>
                      In Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('Scheduled')}>
                      Scheduled
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  className="rounded-xl border-border/50 hover:border-primary/50 h-9 px-4 text-sm gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </Button>
              </div>

              {/* Job List */}
              <div className="space-y-2">
                {filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-accent/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 ring-1 ring-primary/20 shadow-sm flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm mb-0.5 truncate">{job.address}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.startDate} • Due {job.dueDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="secondary" 
                        className={`${getStatusColor(job.status)} border text-xs h-6 px-2`}
                      >
                        {job.status}
                      </Badge>
                      <p className="text-sm font-medium min-w-20 text-right">
                        ${job.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {filteredJobs.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-xl bg-muted mx-auto mb-3 flex items-center justify-center">
                    <Search className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No jobs found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Customer Details Sidebar */}
        <div className="lg:col-span-1">
          <Card className="border-border/50 shadow-sm rounded-2xl sticky top-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Avatar and Name */}
              <div className="text-center pb-4 border-b border-border/50">
                <div className={`w-16 h-16 rounded-2xl ${customer.avatarColor} flex items-center justify-center text-white mx-auto mb-3 shadow-lg`}>
                  <span className="text-xl">{customer.avatar}</span>
                </div>
                <h3 className="mb-1">{customer.name}</h3>
                <p className="text-xs text-muted-foreground">{customer.company}</p>
              </div>

              {/* Contact Information */}
              <div className="space-y-3 pb-4 border-b border-border/50">
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                    <p className="text-sm truncate">{customer.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                    <p className="text-sm">{customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-0.5">Company</p>
                    <p className="text-sm">{customer.company}</p>
                  </div>
                </div>
              </div>

              {/* Category */}
              <div className="pb-4 border-b border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Category</p>
                {customer.category ? (
                  <Badge variant="secondary" className="bg-muted text-foreground text-xs">
                    {customer.category}
                  </Badge>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No category</p>
                )}
              </div>

              {/* Customer Notes */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Customer notes</p>
                {customer.notes ? (
                  <p className="text-sm">{customer.notes}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No category</p>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-2">
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-border/50 hover:border-primary/50 h-9 text-sm"
                >
                  Edit Customer
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-border/50 hover:border-destructive/50 hover:text-destructive h-9 text-sm"
                >
                  Delete Customer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
