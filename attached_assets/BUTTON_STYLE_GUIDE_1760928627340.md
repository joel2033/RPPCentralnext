# Button Style Guide
## Real Property Photography (RPP) Dashboard

---

## **OVERVIEW**

This guide defines all button styles, variants, sizes, and usage patterns for the RPP dashboard. All buttons follow the RPP brand identity with the signature orange (#F05A2A) as the primary action color and grey palette for secondary actions.

---

## **BRAND COLORS FOR BUTTONS**

```css
/* Primary Actions */
--primary: #F05A2A (RPP Orange)
--primary-foreground: #ffffff (White text)

/* Secondary/Outline */
--border: #E8E9EA (Light grey border)
--secondary: #F4F5F5 (Light grey background)
--secondary-foreground: #2F373F (Dark grey text)

/* Destructive Actions */
--destructive: #C04821 (Dark red)
--destructive-foreground: #ffffff (White text)

/* Muted/Ghost */
--muted: #EAEBEB
--muted-foreground: #595F65
```

---

## **BUTTON VARIANTS**

### **1. PRIMARY BUTTON (Default)**

The standard button for primary actions.

#### **Basic Primary**
```tsx
<Button>Click me</Button>
```

**Classes:**
```css
bg-primary 
text-primary-foreground 
hover:bg-primary/90
rounded-xl
```

**Visual:**
- Background: RPP Orange (#F05A2A)
- Text: White
- Border Radius: 1rem (rounded-xl)
- Padding: px-4 py-2 (default size)
- Font Weight: 500 (medium)
- Hover: Slightly darker orange (primary/90)

#### **Usage:**
- Main call-to-action buttons
- Form submissions
- Primary navigation actions
- Confirmations

**Example:**
```tsx
<Button>Save Changes</Button>
<Button>Create Project</Button>
<Button>Submit</Button>
```

---

### **2. PRIMARY GRADIENT BUTTON**

Enhanced primary button with gradient for special emphasis.

#### **Code:**
```tsx
<Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 rounded-xl">
  <Plus className="w-4 h-4 mr-2" />
  New Project
</Button>
```

**Classes:**
```css
bg-gradient-to-r from-primary to-primary/90
hover:from-primary/90 hover:to-primary
text-primary-foreground
shadow-lg shadow-primary/25
hover:shadow-xl hover:shadow-primary/30
transition-all duration-200
rounded-xl
```

**Visual:**
- Gradient: Left to right, solid orange to 90% orange
- Hover: Reverses gradient direction
- Shadow: Colored shadow with primary/25 opacity
- Hover Shadow: Larger shadow with primary/30 opacity
- Animation: Smooth transition (200ms)

#### **Usage:**
- **MOST IMPORTANT** action on the page
- Primary CTAs that need extra emphasis
- "Create" or "Add" actions
- Limited to 1-2 per page maximum

**Examples:**
```tsx
// Dashboard main action
<Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 rounded-xl">
  <Plus className="w-4 h-4 mr-2" />
  New Project
</Button>

// Order submission
<Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 rounded-xl">
  Submit Order
</Button>

// Download all (important action)
<Button className="bg-gradient-to-r from-primary to-primary/90 rounded-xl">
  <Download className="w-4 h-4 mr-2" />
  Download All
</Button>
```

---

### **3. SECONDARY BUTTON**

For secondary actions that need visibility but less emphasis.

#### **Code:**
```tsx
<Button variant="secondary">Cancel</Button>
```

**Classes:**
```css
bg-secondary 
text-secondary-foreground
hover:bg-secondary/80
rounded-xl
```

**Visual:**
- Background: Light grey (#F4F5F5)
- Text: Dark grey (#2F373F)
- Border Radius: 1rem (rounded-xl)
- Hover: Slightly darker background

#### **Usage:**
- Cancel actions
- Secondary options in dialogs
- Alternative actions
- Back buttons (when not outline)

**Examples:**
```tsx
<Button variant="secondary">Cancel</Button>
<Button variant="secondary">Back to Job</Button>
<Button variant="secondary">Skip</Button>
```

---

### **4. OUTLINE BUTTON**

Transparent with border, for less prominent actions.

#### **Code:**
```tsx
<Button variant="outline" className="rounded-xl border-border/50 hover:border-primary/50">
  View Details
</Button>
```

**Classes:**
```css
border border-border/50
bg-transparent
text-foreground
hover:bg-accent
hover:border-primary/50
rounded-xl
```

**Visual:**
- Background: Transparent
- Border: Light grey with 50% opacity
- Text: Dark grey (#2F373F)
- Border Radius: 1rem (rounded-xl)
- Hover: Light grey background + orange-tinted border

#### **Usage:**
- View/preview actions
- Navigation buttons
- Filter buttons
- Secondary actions with less emphasis than filled secondary

**Examples:**
```tsx
// Navigation actions
<Button variant="outline" className="rounded-xl border-border/50 hover:border-primary/50">
  View Client Delivery
</Button>

<Button variant="outline" className="rounded-xl border-border/50 hover:border-primary/50">
  View Sample Job
</Button>

// Filter/sort actions
<Button variant="outline" className="rounded-xl border-border/50">
  <Filter className="w-4 h-4 mr-2" />
  Filters
</Button>
```

---

### **5. GHOST BUTTON**

Minimal styling, no background or border.

#### **Code:**
```tsx
<Button variant="ghost" className="rounded-xl">
  Clear
</Button>
```

**Classes:**
```css
bg-transparent
border-0
text-foreground
hover:bg-accent
hover:text-accent-foreground
rounded-xl
```

**Visual:**
- Background: Transparent
- Border: None
- Text: Dark grey
- Hover: Light grey background
- Border Radius: 1rem (rounded-xl)

#### **Usage:**
- Clear/reset actions
- Subtle navigation
- Close buttons (with X icon)
- Tertiary actions
- Dropdown menu triggers

**Examples:**
```tsx
// Clear action
<Button variant="ghost" className="rounded-xl">
  Clear
</Button>

// Close button
<Button variant="ghost" size="icon" className="rounded-xl">
  <X className="w-4 h-4" />
</Button>

// Menu item
<Button variant="ghost" className="rounded-xl justify-start w-full">
  <Settings className="w-4 h-4 mr-2" />
  Settings
</Button>
```

---

### **6. DESTRUCTIVE BUTTON**

For dangerous/irreversible actions.

#### **Code:**
```tsx
<Button variant="destructive" className="rounded-xl">
  Delete Project
</Button>
```

**Classes:**
```css
bg-destructive
text-destructive-foreground
hover:bg-destructive/90
rounded-xl
```

**Visual:**
- Background: Dark red (#C04821)
- Text: White
- Border Radius: 1rem (rounded-xl)
- Hover: Slightly darker red

#### **Usage:**
- Delete actions
- Permanent removals
- Destructive operations
- Account termination
- Always pair with confirmation dialog

**Examples:**
```tsx
<Button variant="destructive" className="rounded-xl">
  <Trash2 className="w-4 h-4 mr-2" />
  Delete Project
</Button>

<Button variant="destructive" className="rounded-xl">
  Remove Customer
</Button>
```

---

### **7. LINK BUTTON**

Text-only button that looks like a link.

#### **Code:**
```tsx
<Button variant="link">Learn more</Button>
```

**Classes:**
```css
text-primary
underline-offset-4
hover:underline
bg-transparent
border-0
```

**Visual:**
- Text: RPP Orange (#F05A2A)
- Underline: On hover
- Background: Transparent
- No border

#### **Usage:**
- Inline text links
- "Learn more" actions
- Secondary navigation
- Help/documentation links

**Examples:**
```tsx
<Button variant="link">Learn more</Button>
<Button variant="link">View documentation</Button>
<Button variant="link">Read terms</Button>
```

---

## **BUTTON SIZES**

### **Default (Standard)**
```tsx
<Button>Default Size</Button>
```
- Height: h-10 (40px)
- Padding: px-4 py-2
- Font Size: text-base (16px)
- Icon Size: w-4 h-4 (16px)

---

### **Small (sm)**
```tsx
<Button size="sm" className="rounded-xl h-9 px-4 text-sm">
  Small Button
</Button>
```
- Height: h-9 (36px)
- Padding: px-4
- Font Size: text-sm (14px)
- Icon Size: w-4 h-4 (16px)

**Usage:**
- Secondary actions in toolbars
- Compact interfaces
- Action buttons in cards
- Filter chips

**Examples:**
```tsx
<Button size="sm" className="rounded-xl">
  Select All
</Button>

<Button size="sm" className="bg-gradient-to-r from-primary to-primary/90 rounded-xl">
  <Download className="w-4 h-4 mr-2" />
  Download All
</Button>
```

---

### **Large (lg)**
```tsx
<Button size="lg" className="rounded-xl">
  Large Button
</Button>
```
- Height: h-11 (44px)
- Padding: px-8
- Font Size: text-base (16px)
- Icon Size: w-5 h-5 (20px)

**Usage:**
- Hero CTAs
- Mobile primary actions
- Full-width buttons in modals
- Touch-friendly interfaces

**Examples:**
```tsx
<Button size="lg" className="rounded-xl w-full">
  Get Started
</Button>

<Button size="lg" className="bg-gradient-to-r from-primary to-primary/90 rounded-xl">
  <Plus className="w-5 h-5 mr-2" />
  Create Account
</Button>
```

---

### **Icon Only**
```tsx
<Button size="icon" className="rounded-xl">
  <X className="w-4 h-4" />
</Button>
```
- Height: h-10 w-10 (40px square)
- Padding: Equal padding
- Icon Size: w-4 h-4 (16px)

**Usage:**
- Close buttons
- Action icons in toolbars
- Compact controls
- Always include aria-label for accessibility

**Examples:**
```tsx
// Close button
<Button variant="ghost" size="icon" className="rounded-xl">
  <X className="w-4 h-4" />
</Button>

// Edit button
<Button variant="outline" size="icon" className="rounded-xl">
  <Edit className="w-4 h-4" />
</Button>

// Delete button
<Button variant="destructive" size="icon" className="rounded-xl">
  <Trash2 className="w-4 h-4" />
</Button>
```

---

## **BUTTONS WITH ICONS**

### **Icon Left (Most Common)**
```tsx
<Button className="rounded-xl">
  <Plus className="w-4 h-4 mr-2" />
  Add Item
</Button>
```

**Icon Spacing:**
- Icon size: w-4 h-4 (16px)
- Margin right: mr-2 (8px)
- Vertical alignment: Automatic

**Usage:**
- Actions (Add, Create, Edit, Delete)
- Navigation (Back, Next, Forward)
- Downloads
- Most button icons should be on the left

---

### **Icon Right**
```tsx
<Button className="rounded-xl">
  Next Step
  <ChevronRight className="w-4 h-4 ml-2" />
</Button>
```

**Icon Spacing:**
- Icon size: w-4 h-4 (16px)
- Margin left: ml-2 (8px)

**Usage:**
- "Next" navigation
- Dropdown indicators
- External links
- Forward movement

---

### **Icon Only (Repeated for Emphasis)**
```tsx
<Button size="icon" variant="ghost" className="rounded-xl" aria-label="Close">
  <X className="w-4 h-4" />
</Button>
```

**Important:**
- Always include `aria-label` attribute
- Icon size: w-4 h-4 for default, w-5 h-5 for large
- Button must be square: h-10 w-10

---

## **BUTTON STATES**

### **Default State**
```tsx
<Button className="rounded-xl">Normal</Button>
```
- Full opacity
- Base colors
- No special styling

---

### **Hover State**
All buttons have hover states defined:

**Primary:**
```css
hover:bg-primary/90
```

**Gradient Primary:**
```css
hover:from-primary/90 hover:to-primary
hover:shadow-xl hover:shadow-primary/30
```

**Outline:**
```css
hover:bg-accent 
hover:border-primary/50
```

**Ghost:**
```css
hover:bg-accent 
hover:text-accent-foreground
```

---

### **Active/Focus State**
```tsx
<Button className="rounded-xl">Active</Button>
```
- Focus ring automatically applied via globals.css
- Ring color: `ring-ring/50` (muted grey with opacity)
- Outline offset: 2px

---

### **Disabled State**
```tsx
<Button disabled className="rounded-xl">
  Disabled
</Button>
```

**Visual:**
- Opacity: 50%
- Cursor: not-allowed
- No hover effects
- Greyed out appearance

**Code:**
```tsx
<Button disabled className="rounded-xl">
  Save Changes
</Button>

<Button variant="outline" disabled className="rounded-xl">
  View Details
</Button>
```

---

### **Loading State**
```tsx
<Button disabled className="rounded-xl">
  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
  Processing...
</Button>
```

**Visual:**
- Disabled while loading
- Spinner icon (animated)
- Text changes to indicate loading

**Example:**
```tsx
import { Loader2 } from "lucide-react";

<Button disabled={isLoading} className="rounded-xl">
  {isLoading ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Saving...
    </>
  ) : (
    <>
      <Save className="w-4 h-4 mr-2" />
      Save Changes
    </>
  )}
</Button>
```

---

## **BUTTON GROUPS**

### **Horizontal Button Group**
```tsx
<div className="flex gap-2">
  <Button variant="outline" className="rounded-xl">
    Cancel
  </Button>
  <Button className="rounded-xl">
    Save
  </Button>
</div>
```

**Spacing:** gap-2 (8px) or gap-3 (12px)

---

### **Button Group with Primary Action**
```tsx
<div className="flex gap-3">
  <Button variant="outline" className="flex-1 rounded-xl">
    Cancel
  </Button>
  <Button className="flex-1 bg-gradient-to-r from-primary to-primary/90 rounded-xl">
    <Send className="w-4 h-4 mr-2" />
    Submit Request
  </Button>
</div>
```

**Pattern:**
- Secondary/cancel on left
- Primary action on right
- Equal width with `flex-1`
- Spacing: gap-3

---

### **Full-Width Stacked Buttons**
```tsx
<div className="space-y-2">
  <Button className="w-full rounded-xl">
    <Download className="w-4 h-4 mr-2" />
    Download Image
  </Button>
  <Button variant="outline" className="w-full rounded-xl">
    Share
  </Button>
</div>
```

**Pattern:**
- Full width: `w-full`
- Vertical spacing: `space-y-2` or `space-y-3`
- Primary action first

---

### **Segmented Control (Toggle Group)**
```tsx
<div className="inline-flex rounded-xl border border-border/50 p-1 gap-1">
  <Button 
    variant={active === 'grid' ? 'secondary' : 'ghost'} 
    size="sm"
    className="rounded-lg"
  >
    <Grid className="w-4 h-4" />
  </Button>
  <Button 
    variant={active === 'list' ? 'secondary' : 'ghost'}
    size="sm" 
    className="rounded-lg"
  >
    <List className="w-4 h-4" />
  </Button>
</div>
```

---

## **SPECIAL BUTTON PATTERNS**

### **Floating Action Button (FAB)**
```tsx
<div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-bottom-4">
  <Card className="border-border/50 shadow-2xl">
    <CardContent className="p-4 flex items-center gap-4">
      <Badge variant="secondary" className="border">
        {selectedItems.length} selected
      </Badge>
      <Separator orientation="vertical" className="h-8" />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="rounded-xl border-primary/50 text-primary hover:bg-primary/10">
          Request Edits
        </Button>
        <Button size="sm" className="bg-gradient-to-r from-primary to-primary/90 rounded-xl">
          <Download className="w-4 h-4 mr-2" />
          Download Selected
        </Button>
        <Button variant="ghost" size="sm" className="rounded-xl">
          Clear
        </Button>
      </div>
    </CardContent>
  </Card>
</div>
```

**Pattern:**
- Fixed positioning
- Centered horizontally
- Shadow for elevation
- Animation on appearance
- Multiple action buttons in card

---

### **Split Button (Dropdown)**
```tsx
<div className="inline-flex rounded-xl border border-border/50">
  <Button className="rounded-none rounded-l-xl border-0">
    Download
  </Button>
  <Separator orientation="vertical" />
  <Button size="icon" className="rounded-none rounded-r-xl border-0">
    <ChevronDown className="w-4 h-4" />
  </Button>
</div>
```

---

### **Close Button (Modal/Dialog)**
```tsx
<Button
  variant="ghost"
  size="icon"
  className="absolute top-2 right-2 lg:top-4 lg:right-4 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background z-20 h-9 w-9 lg:h-10 lg:w-10"
  onClick={onClose}
  aria-label="Close"
>
  <X className="w-4 h-4" />
</Button>
```

**Pattern:**
- Position: Absolute top-right
- Shape: Rounded-full (circular)
- Background: Semi-transparent with backdrop blur
- Always include aria-label

---

### **Badge Button (With Count)**
```tsx
<Button variant="outline" className="rounded-xl relative">
  <MessageSquare className="w-4 h-4 mr-2" />
  Messages
  <Badge className="ml-2 bg-primary text-white rounded-lg px-1.5 py-0.5 text-xs">
    12
  </Badge>
</Button>
```

---

## **BORDER RADIUS STANDARDS**

**All buttons MUST use rounded corners:**

```tsx
// Standard (most buttons)
className="rounded-xl"     // 1rem = 16px

// Large buttons or cards
className="rounded-2xl"    // 1.25rem = 20px

// Icon-only close buttons
className="rounded-full"   // Circular

// Segmented controls (inner buttons)
className="rounded-lg"     // 0.75rem = 12px
```

**❌ NEVER use:**
- `rounded` (too small)
- `rounded-md` (not brand aligned)
- Square buttons (except in specific component designs)

---

## **COMMON BUTTON COMBINATIONS**

### **1. Create/Add Action**
```tsx
<Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 rounded-xl h-9 px-5 text-sm">
  <Plus className="w-4 h-4 mr-2" />
  New Project
</Button>
```

---

### **2. View/Preview Action**
```tsx
<Button variant="outline" className="rounded-xl border-border/50 hover:border-primary/50 h-9 px-4 text-sm">
  View Sample Job
</Button>
```

---

### **3. Download Action**
```tsx
<Button size="sm" className="bg-gradient-to-r from-primary to-primary/90 rounded-xl">
  <Download className="w-4 h-4 mr-2" />
  Download All
</Button>
```

---

### **4. Filter/Sort Action**
```tsx
<Button variant="outline" className="rounded-xl border-border/50 h-9">
  <Filter className="w-4 h-4 mr-2" />
  Filters
</Button>
```

---

### **5. Form Submit (Primary)**
```tsx
<Button className="w-full bg-gradient-to-r from-primary to-primary/90 rounded-xl">
  <Send className="w-4 h-4 mr-2" />
  Submit Review
</Button>
```

---

### **6. Form Cancel (Secondary)**
```tsx
<Button variant="outline" className="flex-1 rounded-xl">
  Cancel
</Button>
```

---

### **7. Delete Action**
```tsx
<Button variant="destructive" className="rounded-xl">
  <Trash2 className="w-4 h-4 mr-2" />
  Delete
</Button>
```

---

### **8. Back Navigation**
```tsx
<Button variant="outline" size="sm" className="rounded-xl">
  <ArrowLeft className="w-4 h-4 mr-2" />
  Back
</Button>
```

---

### **9. Close Button**
```tsx
<Button variant="ghost" size="icon" className="rounded-full bg-background/90 backdrop-blur-sm hover:bg-background h-10 w-10" aria-label="Close">
  <X className="w-4 h-4" />
</Button>
```

---

## **VISUAL HIERARCHY**

### **Priority 1: Primary Gradient**
- Use for THE most important action on the page
- Limit to 1-2 maximum per view
- Examples: "New Project", "Submit Order", "Create Account"

### **Priority 2: Primary Solid**
- Use for important actions
- Can have multiple on same page
- Examples: "Save", "Submit", "Confirm"

### **Priority 3: Outline**
- Use for secondary navigation
- View/preview actions
- Alternative options
- Examples: "View Details", "Cancel", "Back"

### **Priority 4: Ghost**
- Use for tertiary actions
- Utility functions
- Clear/reset actions
- Examples: "Clear", "Close", "More"

### **Special: Destructive**
- Only for dangerous actions
- Always confirm before executing
- Examples: "Delete", "Remove", "Terminate"

---

## **ACCESSIBILITY REQUIREMENTS**

### **1. Icon-Only Buttons**
```tsx
// ✅ GOOD - Has aria-label
<Button size="icon" variant="ghost" className="rounded-xl" aria-label="Close dialog">
  <X className="w-4 h-4" />
</Button>

// ❌ BAD - No aria-label
<Button size="icon" variant="ghost" className="rounded-xl">
  <X className="w-4 h-4" />
</Button>
```

---

### **2. Loading States**
```tsx
<Button disabled={isLoading} aria-busy={isLoading} className="rounded-xl">
  {isLoading ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Saving...
    </>
  ) : (
    "Save Changes"
  )}
</Button>
```

---

### **3. Disabled States**
```tsx
// Include reason if not obvious
<Button disabled title="Complete all required fields first" className="rounded-xl">
  Submit
</Button>
```

---

### **4. Focus Visible**
All buttons automatically get focus ring from globals.css:
```css
outline-ring/50
```
Never remove or override focus indicators!

---

## **RESPONSIVE BEHAVIOR**

### **Mobile (<768px)**
```tsx
// Stack buttons vertically
<div className="flex flex-col gap-2">
  <Button className="w-full rounded-xl">Primary</Button>
  <Button variant="outline" className="w-full rounded-xl">Secondary</Button>
</div>
```

---

### **Tablet/Desktop (≥768px)**
```tsx
// Horizontal layout
<div className="flex gap-3">
  <Button variant="outline" className="rounded-xl">Cancel</Button>
  <Button className="rounded-xl">Save</Button>
</div>
```

---

### **Responsive Size Adjustment**
```tsx
<Button className="h-9 px-4 text-sm lg:h-10 lg:px-6 lg:text-base rounded-xl">
  Responsive Button
</Button>
```

---

## **DO'S AND DON'TS**

### **✅ DO:**
- Always use `rounded-xl` or `rounded-2xl` for brand consistency
- Use gradient primary for most important actions
- Include icons with descriptive text when possible
- Maintain consistent spacing (gap-2 or gap-3)
- Use appropriate variants for visual hierarchy
- Include aria-label for icon-only buttons
- Disable buttons during loading states
- Use full-width buttons in modals/mobile

### **❌ DON'T:**
- Mix different border radii on same page
- Use too many gradient primary buttons (max 1-2)
- Create icon-only buttons without aria-label
- Use destructive variant without confirmation
- Stack more than 3 action buttons
- Use small text that's hard to read
- Remove focus indicators
- Create custom button styles outside this system

---

## **QUICK REFERENCE TABLE**

| Variant | Background | Text Color | Border | Use Case |
|---------|-----------|------------|--------|----------|
| **default** | Primary orange | White | None | Primary actions |
| **gradient** | Orange gradient | White | None | Most important CTA |
| **secondary** | Light grey | Dark grey | None | Secondary actions |
| **outline** | Transparent | Dark grey | Light grey | View/navigation |
| **ghost** | Transparent | Dark grey | None | Tertiary/utility |
| **destructive** | Dark red | White | None | Delete/remove |
| **link** | Transparent | Primary orange | None | Text links |

---

| Size | Height | Padding | Font Size | Icon Size |
|------|--------|---------|-----------|-----------|
| **default** | 40px | px-4 py-2 | 16px | 16px |
| **sm** | 36px | px-4 | 14px | 16px |
| **lg** | 44px | px-8 | 16px | 20px |
| **icon** | 40px | Equal | 16px | 16px |

---

## **CODE SNIPPETS FOR COMMON PATTERNS**

### **Modal Footer Buttons**
```tsx
<DialogFooter>
  <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
    Cancel
  </Button>
  <Button onClick={onSubmit} className="flex-1 bg-gradient-to-r from-primary to-primary/90 rounded-xl">
    <Send className="w-4 h-4 mr-2" />
    Submit
  </Button>
</DialogFooter>
```

---

### **Card Action Buttons**
```tsx
<CardFooter className="flex gap-2">
  <Button variant="outline" size="sm" className="rounded-xl">
    View Details
  </Button>
  <Button size="sm" className="rounded-xl">
    <Download className="w-4 h-4 mr-2" />
    Download
  </Button>
</CardFooter>
```

---

### **Toolbar Buttons**
```tsx
<div className="flex items-center gap-2">
  <Button variant="outline" size="sm" className="rounded-xl">
    <Filter className="w-4 h-4 mr-2" />
    Filters
  </Button>
  <Button variant="outline" size="sm" className="rounded-xl">
    <Calendar className="w-4 h-4 mr-2" />
    Last 30 days
  </Button>
  <Button size="sm" className="bg-gradient-to-r from-primary to-primary/90 rounded-xl">
    <Download className="w-4 h-4 mr-2" />
    Export
  </Button>
</div>
```

---

### **Form Buttons (Full Width)**
```tsx
<div className="space-y-3">
  <Button className="w-full bg-gradient-to-r from-primary to-primary/90 rounded-xl">
    <Send className="w-4 h-4 mr-2" />
    Submit Review
  </Button>
  <Button variant="link" className="w-full">
    Cancel and go back
  </Button>
</div>
```

---

## **CONCLUSION**

This button style guide ensures consistency across the entire RPP dashboard. Always refer to this guide when implementing buttons to maintain brand identity and user experience quality.

**Key Takeaways:**
1. **Always use `rounded-xl`** for buttons
2. **Gradient primary** for most important action only
3. **Include icons** to enhance clarity
4. **Follow visual hierarchy** (gradient > primary > outline > ghost)
5. **Add aria-labels** to icon-only buttons
6. **Maintain spacing** with gap-2 or gap-3

---

**Version:** 1.0  
**Last Updated:** January 20, 2025  
**Framework:** React + ShadCN UI + Tailwind CSS v4  
**Brand:** Real Property Photography (RPP)
