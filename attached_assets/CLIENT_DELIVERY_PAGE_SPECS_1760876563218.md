# Client Delivery Page - Complete Design Specifications
## Real Property Photography (RPP) SaaS Dashboard

---

## **OVERVIEW**

The Client Delivery Page is a professional, client-facing portal where photographers deliver completed media assets to their clients. This page provides a seamless experience for viewing, downloading, reviewing, and requesting revisions on property photography deliverables.

---

## **BRAND IDENTITY**

### **Color Palette**
```css
/* Primary Brand Colors */
--rpp-red: #F05A2A (Primary Orange)
--rpp-red-dark: #C04821
--rpp-red-light: #F37B55
--rpp-red-lighter: #F69C7F
--rpp-red-pale: #F9BDAA
--rpp-red-palest: #FCDFD4

/* Grey Scale */
--rpp-grey-darkest: #2F373F (Primary Text)
--rpp-grey-dark: #595F65
--rpp-grey: #82878C
--rpp-grey-light: #ACAFB2
--rpp-grey-lighter: #D5D7D9
--rpp-grey-lightest: #EAEBEB
--rpp-grey-pale: #F4F5F5

/* Functional Colors */
--background: #FAFAFA
--card: #ffffff
--border: #E8E9EA
--muted: #EAEBEB
```

### **Typography**
- **Font Size Base:** 16px
- **Font Weight Normal:** 400
- **Font Weight Medium:** 500
- **Line Height:** 1.5

### **Design Philosophy**
- Modern, clean, professional aesthetic
- Rounded corners (radius: 1rem base)
- Gradients for primary actions
- Smooth animations and transitions
- Mobile-first responsive design

---

## **PAGE STRUCTURE**

### **1. HEADER (Sticky)**

#### **Layout**
```
┌─────────────────────────────────────────────────────────────┐
│  [LOGO] RPP                              [DELIVERED Badge]   │
│                                                              │
│  [Quick Nav - Shows on scroll] [Jump to:] [...] [Download] │
└─────────────────────────────────────────────────────────────┘
```

#### **Component Details**

**A. Top Header Section**
- **Position:** `sticky top-0 z-20`
- **Background:** `bg-card/95` with `backdrop-blur-xl`
- **Border:** `border-b border-border/50`
- **Padding:** `px-6 py-6`
- **Max Width:** `max-w-7xl mx-auto`

**Elements:**
1. **Brand Logo (Left)**
   - SVG logo with RPP branding
   - Text below: "REAL PROPERTY" / "PHOTOGRAPHY"
   - Font: `text-xs tracking-wider text-muted-foreground`

2. **Status Badge (Right)**
   - Component: Badge
   - Text: "Delivered"
   - Style: `bg-green-50 text-green-700 border-green-200`
   - Icon: CheckCircle2 (lucide-react)
   - Size: 3x3 icon with 1 margin-right

**B. Quick Navigation Bar (Conditional)**
- **Display Condition:** Shows when `scrollY > 400` AND scrolling up
- **Animation:** 
  - Transition: `duration-300`
  - Overflow: `overflow-hidden`
  - Height: `max-h-20` when visible, `max-h-0` when hidden
  - Opacity: `opacity-100` when visible, `opacity-0` when hidden
- **Border:** `border-t border-border/50`

**Quick Nav Content:**
1. **"Jump to:" Label**
   - Text: `text-sm text-muted-foreground whitespace-nowrap`
   - Margin: `mr-2`

2. **Folder Quick Links** (Scrollable)
   - Container: `flex items-center gap-3 overflow-x-auto flex-1`
   - Each Button:
     - Style: `px-4 py-2 rounded-xl bg-secondary`
     - Hover: `hover:bg-primary/10 hover:border-primary/50`
     - Border: `border border-border/50`
     - Icon + Text + Badge layout
     - Badge shows file count: `text-xs h-5 px-1.5 bg-muted/50`
   - onClick: Smooth scroll to folder section

3. **Download All Button**
   - Position: Right side, `flex-shrink-0`
   - Style: `bg-gradient-to-r from-primary to-primary/90`
   - Icon: Download (lucide-react)
   - Text: "Download All"

---

### **2. HERO BANNER**

#### **Layout**
```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  [PROPERTY IMAGE BACKGROUND WITH GRADIENT OVERLAYS]         │
│                                                              │
│  [Badge] Professional Media Delivery                        │
│  123 Ocean View Drive                    [Height: 400px]    │
│  Your high-resolution property photos...                    │
│                                                              │
│  📍 Beverly Hills, CA 90210  📅 Delivered Oct 14, 2025     │
│                                                              │
│  [Photos 24] [Drone 6] [Videos 2] [Twilight 4] [Floor 1]  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### **Component Details**

**Container:**
- Height: `h-[400px]`
- Background: `bg-gradient-to-br from-gray-900 to-gray-800`
- Position: `relative overflow-hidden`

**Background Image:**
- Component: ImageWithFallback
- Position: `absolute inset-0`
- Style: `w-full h-full object-cover`
- Overlays:
  1. `bg-gradient-to-r from-black/70 via-black/50 to-black/30`
  2. `bg-gradient-to-t from-black/60 via-transparent to-transparent`

**Content (Centered, Left-aligned):**
- Container: `max-w-7xl mx-auto px-6`
- Vertical: `flex flex-col justify-center h-full`
- Max Width: `max-w-3xl`

**Elements (Top to Bottom):**

1. **Badge**
   - Text: "Professional Media Delivery"
   - Style: `bg-white/10 text-white border-white/20 backdrop-blur-sm`

2. **Property Name (H1)**
   - Text: Property address (e.g., "123 Ocean View Drive")
   - Style: `text-white text-4xl md:text-5xl mb-3`

3. **Description**
   - Text: "Your high-resolution property photos and videos are ready for download"
   - Style: `text-white/90 text-lg md:text-xl mb-6`

4. **Metadata Row**
   - Container: `flex flex-wrap items-center gap-4 text-white/80 text-sm mb-6`
   - Items:
     - 📍 Location: `MapPin icon + address`
     - 📅 Delivery Date: `Calendar icon + "Delivered [date]"`

5. **Folder Quick Links**
   - Container: `flex flex-wrap items-center gap-3 mt-8`
   - Each Button:
     - Style: `px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm`
     - Hover: `hover:bg-white/20 hover:border-white/40`
     - Layout: Icon + Text + Badge
     - Badge: `bg-white/20 text-white text-xs h-5 px-1.5`
     - Icons: ImageIcon, Video, FileText (based on folder type)
   - onClick: Smooth scroll to folder section

---

### **3. FLOATING ACTION BAR (Conditional)**

#### **Display Condition**
Shows when `selectedItems.length > 0`

#### **Layout**
```
┌────────────────────────────────────────────────────┐
│  [3 selected] | [Request Edits] [Download] [Clear] │
└────────────────────────────────────────────────────┘
```

#### **Component Details**

**Container:**
- Position: `fixed bottom-8 left-1/2 -translate-x-1/2 z-30`
- Animation: `animate-in slide-in-from-bottom-4`
- Component: Card with shadow-2xl

**Content (Horizontal Layout):**
- Padding: `p-4`
- Layout: `flex items-center gap-4`

**Elements:**

1. **Selection Badge**
   - Component: Badge variant="secondary"
   - Text: `{count} selected`
   - Style: Border included

2. **Separator**
   - Component: Separator orientation="vertical"
   - Height: `h-8`

3. **Action Buttons** (flex gap-2):
   
   a. **Request Edits Button**
      - Variant: outline
      - Size: sm
      - Style: `rounded-xl border-primary/50 text-primary hover:bg-primary/10`
      - Text: "Request Edits"
      - onClick: Opens revision request modal
   
   b. **Download Selected Button**
      - Style: `bg-gradient-to-r from-primary to-primary/90 rounded-xl`
      - Icon: Download
      - Text: "Download Selected"
      - onClick: Downloads selected files
   
   c. **Clear Button**
      - Variant: ghost
      - Size: sm
      - Style: `rounded-xl`
      - Text: "Clear"
      - onClick: Clears selection array

---

### **4. MEDIA FOLDERS SECTION**

#### **Layout (Per Folder)**
```
┌─────────────────────────────────────────────────────────────┐
│  Photos              [24 files]  96.4 MB   [Select] [⬇ All] │
├─────────────────────────────────────────────────────────────┤
│  [IMG] [IMG] [IMG] [IMG] [IMG]                              │
│  [IMG] [IMG] [IMG] [IMG] [IMG]     [Responsive Grid]        │
│  [IMG] [IMG] [IMG] [IMG] [IMG]                              │
├─────────────────────────────────────────────────────────────┤
```

#### **Component Details**

**Container:**
- Spacing: `space-y-12` between folders
- Each folder ID: `folder-{folderId}`
- Scroll margin: `scroll-mt-40` (for smooth scroll positioning)

**A. Folder Header**
- Layout: `flex items-center justify-between`

**Left Side:**
1. **Folder Name (H2)**
   - Text: Folder name (e.g., "Photos", "Drone Photography", "Video Tours")
   - Style: `text-3xl font-bold mb-0`

2. **File Count Badge**
   - Component: Badge variant="secondary"
   - Text: `{count} files`
   - Style: `border border-border/50`

3. **Total Size**
   - Text: e.g., "96.4 MB"
   - Style: `text-sm text-muted-foreground`

**Right Side (Action Buttons):**
1. **Select All Button**
   - Variant: outline
   - Size: sm
   - Style: `rounded-xl`
   - States:
     - All selected: Shows checkmark icon + "Selected"
     - Some selected: Shows "Select All"
     - None selected: Shows "Select All"
   - onClick: Toggles all files in folder

2. **Download All Button**
   - Style: `bg-gradient-to-r from-primary to-primary/90 rounded-xl`
   - Size: sm
   - Icon: Download
   - Text: "Download All"
   - onClick: Downloads entire folder

**B. Media Grid**
- Grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4`

**C. Media Item Card**

**Container:**
- Aspect Ratio: `aspect-square`
- Style: `rounded-xl overflow-hidden border-2 bg-muted`
- Border Color: 
  - Selected: `var(--primary)`
  - Not selected: `var(--border)`
- Hover: `hover:shadow-xl`
- Cursor: `cursor-pointer`
- Transition: `transition-all duration-200`

**Elements (Layered):**

1. **Image**
   - Component: ImageWithFallback
   - Style: `w-full h-full object-cover`
   - Hover: `group-hover:scale-105 transition-transform duration-300`

2. **Selection Checkbox (Top Left)**
   - Position: `absolute top-3 left-3 z-10`
   - Container: `w-6 h-6 rounded-lg border-2`
   - States:
     - Selected: `bg-primary border-primary` with white checkmark
     - Not selected: `bg-white/90 border-white/90 hover:bg-white`
   - onClick: Toggle selection (stopPropagation)

3. **Revision Badge (Top Right)** *if comments exist*
   - Position: `absolute top-3 right-3 z-10`
   - Style: `bg-primary text-white rounded-full w-7 h-7 flex items-center justify-center`
   - Icon: MessageSquare
   - Border: `border-2 border-white shadow-lg`

4. **Video Play Icon** *if type is video*
   - Position: `absolute inset-0 flex items-center justify-center pointer-events-none`
   - Container: `w-16 h-16 bg-white/90 rounded-full flex items-center justify-center`
   - Icon: Play (filled) with ml-1 offset

5. **Hover Overlay**
   - Position: `absolute inset-0`
   - Gradient: `bg-gradient-to-t from-black/70 via-transparent to-transparent`
   - Opacity: `opacity-0 group-hover:opacity-100`
   - Transition: `transition-opacity duration-200`

6. **Hover Info (Bottom)**
   - Position: `absolute bottom-3 left-3 right-3`
   - Opacity: `opacity-0 group-hover:opacity-100`
   - Layout: `flex items-center justify-between`
   
   **Left:**
   - Title: `text-white text-xs truncate`
   - Dimensions: `text-white/80 text-xs mt-0.5`
   
   **Right:**
   - Download Button:
     - Style: `p-1.5 bg-white/90 rounded-lg hover:bg-white`
     - Icon: Download (3.5x3.5)
     - onClick: Download single file (stopPropagation)

**onClick (Card):** Opens ImageDetailModal

**D. Folder Separator**
- Component: Separator
- Margin: `mt-8`

---

### **5. MODALS & OVERLAYS**

#### **A. REVISION REQUEST MODAL**

**Display Condition:** `showRevisionRequest === true`

**Layout:**
```
┌────────────────────────────────────────────┐
│  Request Edits                         [X] │
│  Describe the changes you'd like...        │
├────────────────────────────────────────────┤
│  ⓘ Selected 3 files for revision           │
│                                             │
│  [Textarea - Multi-line input]             │
│  Character count display                   │
│                                             │
│  [Cancel]         [Submit Request]         │
└────────────────────────────────────────────┘
```

**Component:** Card with `border-primary/30 shadow-lg`

**Header:**
- Title: "Request Edits"
- Description: "Describe the changes you'd like for the selected files"
- Close Button (X): Top right, ghost variant, icon button

**Content:**

1. **Alert Banner**
   - Component: Alert
   - Icon: AlertCircle
   - Text: `Selected {count} file(s) for revision`

2. **Textarea Field**
   - Label: "What changes would you like?"
   - Placeholder: Multi-line example text suggesting specific edit types
   - Rows: 6
   - Style: `rounded-xl resize-none`
   - Character counter below

3. **Action Buttons**
   - Layout: `flex gap-3`
   - Cancel: outline, flex-1, rounded-xl
   - Submit: gradient primary, flex-1, rounded-xl with Send icon
   - Disabled state when notes.length < 10

**Success State:**
- Shows checkmark icon in blue circle
- Title: "Revision Request Submitted!"
- Message: "Your photographer will review your request..."
- Close Button

---

#### **B. IMAGE DETAIL MODAL**

**Display Condition:** `selectedMediaForModal !== null`

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│                                                          [X]  │
│                                                               │
│                    [LARGE IMAGE DISPLAY]                      │
│                                                               │
│                                                        │ Info │
│                                                        │  &   │
│                                                        │ Rev. │
├───────────────────────────────────────────────────────┴──────┤
│  [◀] [thumb][thumb][thumb][thumb][thumb][thumb][thumb] [▶]  │
└──────────────────────────────────────────────────────────────┘
```

**Container:**
- Component: Dialog with DialogContent
- Size: `max-w-[100vw] lg:max-w-[95vw] xl:max-w-[1800px]`
- Height: `h-[100dvh] lg:h-[95vh]`
- Padding: `p-0 gap-0`
- Border Radius: `rounded-none lg:rounded-lg`

**Structure:** Vertical flex layout

**Main Content Area (Flex Row):**

**1. Large Image Display (Left Side - Flex 1)**
- Background: `bg-muted/30`
- Layout: `flex items-center justify-center`
- Padding: `p-4 lg:p-8`

**Elements:**
- **Close Button:** Top right, floating
  - Style: `bg-background/90 backdrop-blur-sm hover:bg-background rounded-full`
  - Size: `h-9 w-9 lg:h-10 lg:w-10`
  - Position: `absolute top-2 right-2 lg:top-4 lg:right-4`

- **Large Image:**
  - Component: ImageWithFallback
  - Style: `max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-2xl`

- **Video Play Icon** (if video):
  - Centered overlay
  - Size: `w-16 h-16 lg:w-24 lg:h-24`
  - Style: `bg-white/90 rounded-full shadow-xl`

**2. Right Sidebar (Fixed Width)**
- Width: `w-full lg:w-[320px] xl:w-[360px]`
- Border: `border-t lg:border-t-0 lg:border-l border-border`
- Background: `bg-background`
- Layout: Vertical flex column

**A. Image Info Section (Top)**
- Padding: `p-4 lg:p-5`
- Border: `border-b border-border`

**Content:**
1. **Title (H3):** Image filename
2. **Badges:**
   - Dimensions badge (if exists)
   - File size badge
   - Style: `text-xs` secondary badges
3. **Download Button:**
   - Full width
   - Gradient primary style
   - Icon: Download
   - Text: "Download Image"

**B. Revision Comments Section (Scrollable)**
- Component: ScrollArea
- Layout: Vertical flex-1 (takes remaining space)
- Padding: `p-4 lg:p-5`

**Header:**
- Title (H4): "Comments & Revisions"
- Badge: Count of comments

**Comments List:**
- Container: `space-y-3`
- Each Comment:
  - Layout: `space-y-2`
  - **Header:** Author name + timestamp
    - Font: `text-xs`
    - Author (Client): `font-medium text-foreground`
    - Author (Photographer): `font-medium text-primary`
    - Timestamp: `text-muted-foreground`
  
  - **Message:**
    - Text: `text-sm text-foreground`
    - Background: 
      - Client: `bg-muted/50 rounded-xl p-3`
      - Photographer: `bg-primary/10 rounded-xl p-3`
  
  - **Status Badge** (if exists):
    - Resolved: `bg-emerald-500/10 text-emerald-600`
    - In Progress: `bg-amber-500/10 text-amber-600`
    - Pending: `bg-blue-500/10 text-blue-600`
    - Size: `text-xs px-2 py-0.5`

**Empty State:**
- Icon: MessageSquare muted
- Text: "No comments yet"
- Subtitle: "Click below to start..."

**C. New Comment Input (Bottom)**
- Padding: `p-4 lg:p-5`
- Border: `border-t border-border`

**Elements:**
1. **Textarea:**
   - Placeholder: "Add a comment or revision request..."
   - Rows: 3
   - Style: `rounded-xl resize-none`

2. **Submit Button:**
   - Full width
   - Gradient primary
   - Icon: Send
   - Text: "Submit Comment"
   - Disabled when empty
   - Loading state when submitting

**3. Thumbnail Carousel (Bottom - Full Width)**
- Container: `border-t border-border`
- Background: `bg-muted/30`
- Padding: `p-3 lg:p-4`

**Layout:**
- Flex row with centered alignment
- Gap: `gap-2`

**Navigation Buttons:**
- Position: Left and right
- Variant: ghost
- Size: icon
- Style: `h-12 w-12 rounded-xl`
- Disabled: When at first/last item

**Thumbnail Container:**
- Component: ScrollArea with horizontal orientation
- Layout: `flex gap-2`
- Max width: `max-w-[calc(100%-120px)]` (account for nav buttons)

**Thumbnail Items:**
- Size: `w-16 h-16 lg:w-20 lg:h-20`
- Style: `rounded-lg overflow-hidden cursor-pointer`
- Border: 
  - Active: `border-2 border-primary`
  - Inactive: `border-2 border-transparent hover:border-border`
- Opacity: 
  - Active: `opacity-100`
  - Inactive: `opacity-60 hover:opacity-100`
- Image: `object-cover`
- Transition: `transition-all duration-200`
- onClick: Navigate to that image

**Keyboard Navigation:**
- Left Arrow: Previous image
- Right Arrow: Next image

---

#### **C. RATING & REVIEW COMPONENT**

**Layout:**
```
┌────────────────────────────────────────────┐
│  Rate Your Experience                      │
│  Help us improve by sharing...             │
├────────────────────────────────────────────┤
│  Overall Rating                            │
│  ★ ★ ★ ★ ★    Excellent!                  │
│                                             │
│  Your Review (Optional)                    │
│  [Textarea - 5 rows]                       │
│  0 / 500 characters                        │
│                                             │
│  [Submit Review]                           │
└────────────────────────────────────────────┘
```

**Component:** Card with border-border/50

**Header:**
- Title: "Rate Your Experience"
- Description: "Help us improve by sharing your thoughts on the quality and service"

**Content:**

1. **Star Rating Section**
   - Label: "Overall Rating"
   - Stars: 5 interactive stars
   - Size: `w-10 h-10`
   - States:
     - Unselected: `fill-none text-muted-foreground`
     - Selected/Hovered: `fill-primary text-primary`
   - Hover effect: `hover:scale-110 transition-all duration-200`
   - Feedback text:
     - 5 stars: "Excellent!"
     - 4 stars: "Great!"
     - 3 stars: "Good"
     - 2 stars: "Fair"
     - 1 star: "Poor"

2. **Review Textarea**
   - Label: "Your Review (Optional)"
   - Placeholder: "Share your experience with the photography service, image quality, professionalism, etc."
   - Rows: 5
   - Style: `rounded-xl resize-none`
   - Character counter: `{length} / 500 characters`

3. **Submit Button**
   - Full width
   - Gradient primary style
   - Icon: Send
   - Text: "Submit Review"
   - Disabled when rating === 0

**Success State:**
- Shows green checkmark icon
- Title: "Thank You for Your Feedback!"
- Message: "We appreciate your review..."

---

### **6. FOOTER**

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                [RATING & REVIEW SECTION]                    │
├─────────────────────────────────────────────────────────────┤
│  © 2025 Real Property Photography. All rights reserved.     │
│  Files are available for download for 30 days               │
│                                                              │
│  Need help? Contact us at hello@realpropertyphoto.com       │
│  or (310) 555-0199                                          │
└─────────────────────────────────────────────────────────────┘
```

**Spacing:** `mt-16 space-y-8`

**Elements:**

1. **Rating Review Component** (see above)

2. **Footer Text Section**
   - Alignment: `text-center`
   - Padding: `py-8`
   - Font: `text-sm text-muted-foreground`
   - Border: `border-t border-border/50`
   
   **Lines:**
   - Copyright notice
   - Download availability notice (mt-2)
   - Contact information (mt-4):
     - Email link: `text-primary hover:underline`
     - Phone link: `text-primary hover:underline`

---

## **DATA STRUCTURE**

### **Mock Delivery Object**
```typescript
const mockDelivery = {
  propertyName: string,      // "123 Ocean View Drive"
  propertyAddress: string,   // "Beverly Hills, CA 90210"
  deliveryDate: string,      // "October 14, 2025"
  photographer: {
    name: string,            // "Real Property Photography"
    email: string,           // "hello@realpropertyphoto.com"
    phone: string,           // "(310) 555-0199"
  },
  status: string,            // "Delivered"
};
```

### **Media Folders Array**
```typescript
interface MediaItem {
  id: number;
  url: string;               // Image URL (use ImageWithFallback component)
  type: 'photo' | 'video';
  title: string;             // Filename
  size: string;              // "4.2 MB"
  dimensions?: string;       // "6000 × 4000 px"
}

interface MediaFolder {
  id: string;                // "photography", "drone", "video", etc.
  name: string;              // "Photos", "Drone Photography", etc.
  fileCount: number;         // 24
  totalSize: string;         // "96.4 MB"
  media: MediaItem[];
}

const mediaFolders: MediaFolder[] = [...];
```

### **Revision Comments**
```typescript
interface RevisionComment {
  id: string;
  author: string;
  authorRole: 'client' | 'photographer';
  message: string;
  timestamp: string;         // "Oct 13, 2025 at 2:30 PM"
  status: 'pending' | 'resolved' | 'in-progress';
}

// Organized by media ID
const revisionComments: Record<number, RevisionComment[]> = {
  1: [...],
  2: [...],
};
```

---

## **STATE MANAGEMENT**

### **Required State Variables**
```typescript
const [selectedItems, setSelectedItems] = useState<number[]>([]);
const [showRevisionRequest, setShowRevisionRequest] = useState(false);
const [selectedMediaForModal, setSelectedMediaForModal] = useState<MediaItem | null>(null);
const [currentMediaIndex, setCurrentMediaIndex] = useState<number>(0);
const [revisionComments, setRevisionComments] = useState(initialComments);
const [showQuickNav, setShowQuickNav] = useState(true);
```

### **Key Functions**

**Selection Management:**
```typescript
// Toggle single item selection
const toggleSelection = (id: number) => {
  setSelectedItems(prev => 
    prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
  );
};

// Select/deselect all items in folder
const selectAllInFolder = (folder: MediaFolder) => {
  const folderIds = folder.media.map(m => m.id);
  const allSelected = folderIds.every(id => selectedItems.includes(id));
  
  if (allSelected) {
    setSelectedItems(prev => prev.filter(id => !folderIds.includes(id)));
  } else {
    setSelectedItems(prev => [...new Set([...prev, ...folderIds])]);
  }
};
```

**Navigation:**
```typescript
// Image modal navigation
const handleNavigate = (direction: 'prev' | 'next') => {
  const newIndex = direction === 'prev' ? currentMediaIndex - 1 : currentMediaIndex + 1;
  if (newIndex >= 0 && newIndex < allMediaItems.length) {
    setCurrentMediaIndex(newIndex);
    setSelectedMediaForModal(allMediaItems[newIndex]);
  }
};

// Smooth scroll to folder
const scrollToFolder = (folderId: string) => {
  const element = document.getElementById(`folder-${folderId}`);
  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
```

**Quick Nav Scroll Detection:**
```typescript
useEffect(() => {
  const lastScrollY = useRef(0);
  
  const handleScroll = () => {
    const currentScrollY = window.scrollY;
    
    // Show nav when at top
    if (currentScrollY < 100) {
      setShowQuickNav(true);
    }
    // Show when scrolling up
    else if (currentScrollY < lastScrollY.current) {
      setShowQuickNav(true);
    }
    // Hide when scrolling down
    else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
      setShowQuickNav(false);
    }
    
    lastScrollY.current = currentScrollY;
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

**Comments:**
```typescript
const handleSubmitImageComment = (mediaId: number, comment: string) => {
  const newComment = {
    id: Date.now().toString(),
    author: 'John Smith',
    authorRole: 'client' as const,
    message: comment,
    timestamp: new Date().toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    }),
    status: 'pending' as const,
  };

  setRevisionComments(prev => ({
    ...prev,
    [mediaId]: [...(prev[mediaId] || []), newComment],
  }));
};
```

---

## **INTERACTIONS & BEHAVIORS**

### **1. Image/Video Clicking**
- **Action:** Opens ImageDetailModal
- **Behavior:** 
  - Finds index in flat array of all media items
  - Sets currentMediaIndex
  - Sets selectedMediaForModal
  - Modal displays with full resolution image
  - Can navigate with keyboard arrows or thumbnail clicks

### **2. Selection System**
- **Individual Selection:**
  - Click checkbox on thumbnail
  - Stops propagation (doesn't open modal)
  - Toggles selection state
  - Updates border color
  - Updates floating action bar

- **Folder Selection:**
  - "Select All" button in folder header
  - Checks if all items in folder are selected
  - Toggles all items in folder
  - Button text changes to "Selected" when all selected

### **3. Download Actions**
- **Download Single:**
  - Hover button on thumbnail
  - Stops propagation
  - Triggers download of single file
  - Alert: "Downloading [filename]..."

- **Download Folder:**
  - Button in folder header
  - Downloads all files in folder
  - Alert: "Downloading [folder name]..."

- **Download Selected:**
  - Button in floating action bar
  - Downloads all selected files
  - Alert: "Downloading {count} files..."

- **Download All:**
  - Button in quick nav bar (header)
  - Downloads all files from all folders
  - Alert: "Downloading all files..."

### **4. Revision Requests**
- **Bulk Revision:**
  - Select multiple files
  - Click "Request Edits" in floating action bar
  - Opens RevisionRequest component
  - Submit with notes (min 10 characters)
  - Shows success state
  - Clears selection

- **Per-Image Revision:**
  - Open ImageDetailModal
  - Add comment in revision section
  - Comment is submitted immediately
  - Appears in comments list
  - Badge appears on thumbnail showing comment count

### **5. Scroll Behaviors**
- **Hero Quick Links:**
  - Always visible in hero section
  - Smooth scroll to folder
  - Backdrop blur effect

- **Quick Nav (Header):**
  - Hidden by default
  - Appears when scrollY > 400
  - Auto-hides when scrolling down
  - Auto-shows when scrolling up
  - Smooth height/opacity transitions

### **6. Rating & Review**
- **Star Interaction:**
  - Hover to preview rating
  - Click to set rating
  - Scale animation on hover
  - Feedback text appears

- **Submit:**
  - Requires at least 1 star
  - Review text optional
  - Shows success state on submit
  - Cannot re-submit (one-time action)

---

## **RESPONSIVE BEHAVIOR**

### **Breakpoints**
```
Mobile:  < 768px  (md)
Tablet:  768px-1024px (md-lg)
Desktop: > 1024px (lg)
Large:   > 1280px (xl)
```

### **Responsive Adjustments**

**Header:**
- Mobile: Single column, reduced padding
- Desktop: Full horizontal layout

**Hero:**
- Mobile: h-[300px], text-3xl
- Desktop: h-[400px], text-4xl-5xl

**Media Grid:**
- Mobile: 2 columns
- Tablet: 3 columns
- Desktop: 4 columns
- Large: 5 columns

**Image Modal:**
- Mobile: Full screen, vertical layout
- Desktop: 95vw with side panel

**Quick Nav:**
- Mobile: Horizontal scroll for buttons
- Desktop: All visible

---

## **REQUIRED DEPENDENCIES**

### **React & Hooks**
```typescript
import { useState, useEffect, useRef } from "react";
```

### **Components (ShadCN/UI)**
```typescript
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Separator } from "./ui/separator";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Alert, AlertDescription } from "./ui/alert";
```

### **Custom Components**
```typescript
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { BrandLogo } from "./BrandLogo";
import { RatingReview } from "./RatingReview";
import { RevisionRequest } from "./RevisionRequest";
import { ImageDetailModal } from "./ImageDetailModal";
```

### **Icons (Lucide React)**
```typescript
import {
  Calendar,
  MapPin,
  CheckCircle2,
  Download,
  Check,
  Image as ImageIcon,
  Video,
  Play,
  FileText,
  MessageSquare,
  Send,
  X,
  AlertCircle,
} from "lucide-react";
```

---

## **ACCESSIBILITY**

### **Semantic HTML**
- Use proper heading hierarchy (h1 → h2 → h3)
- Descriptive alt text for all images
- Aria labels for icon-only buttons
- Form labels for all inputs

### **Keyboard Navigation**
- Tab through all interactive elements
- Arrow keys for image modal navigation
- Enter/Space for button activation
- Escape to close modals

### **Screen Reader Support**
- DialogTitle and DialogDescription for modals
- Badge count announcements
- Status indicators
- Loading states

### **Focus Management**
- Visible focus indicators
- Focus trap in modals
- Return focus after modal close

---

## **PERFORMANCE OPTIMIZATIONS**

### **Image Loading**
- Use ImageWithFallback component for graceful degradation
- Lazy load images below fold
- Thumbnail optimization in carousel

### **Scroll Performance**
- Passive scroll listeners
- Debounced scroll handlers
- CSS transforms for animations

### **Re-render Optimization**
- Memoize expensive computations
- useCallback for event handlers
- Conditional rendering for hidden elements

---

## **SAMPLE DATA STRUCTURE**

### **Example Media Folders**
```typescript
const mediaFolders = [
  {
    id: "photography",
    name: "Photos",
    fileCount: 24,
    totalSize: "96.4 MB",
    media: [
      {
        id: 1,
        url: '[unsplash image URL]',
        type: 'photo',
        title: 'Front Exterior.jpg',
        size: '4.2 MB',
        dimensions: '6000 × 4000 px',
      },
      // ... more items
    ],
  },
  {
    id: "drone",
    name: "Drone Photography",
    fileCount: 6,
    totalSize: "29.1 MB",
    media: [...],
  },
  {
    id: "video",
    name: "Video Tours",
    fileCount: 2,
    totalSize: "43.0 MB",
    media: [...],
  },
  {
    id: "twilight",
    name: "Twilight Images",
    fileCount: 4,
    totalSize: "16.4 MB",
    media: [...],
  },
  {
    id: "floorplan",
    name: "Floor Plan",
    fileCount: 1,
    totalSize: "2.3 MB",
    media: [...],
  },
];
```

---

## **TESTING CHECKLIST**

### **Functional Testing**
- ✅ All images load correctly
- ✅ Selection system works (individual & bulk)
- ✅ Download actions trigger correctly
- ✅ Modal opens and closes properly
- ✅ Image navigation works (arrows & thumbnails)
- ✅ Comments can be added
- ✅ Revision requests can be submitted
- ✅ Rating & review submission works
- ✅ Scroll behaviors work correctly
- ✅ Quick nav appears/disappears properly

### **Responsive Testing**
- ✅ Mobile layout (< 768px)
- ✅ Tablet layout (768-1024px)
- ✅ Desktop layout (> 1024px)
- ✅ Touch interactions work on mobile

### **Browser Testing**
- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

---

## **FUTURE ENHANCEMENTS**

### **Potential Features**
1. **Multi-folder download** - Select multiple folders at once
2. **Sort options** - Sort by name, date, size, type
3. **Filter options** - Filter by type (photo/video)
4. **Share link** - Generate shareable link with expiration
5. **Comparison mode** - Side-by-side before/after
6. **Lightbox gallery** - Fullscreen slideshow mode
7. **Download history** - Track what's been downloaded
8. **Email notifications** - When revisions are complete
9. **Favorites** - Mark favorite images
10. **Print ordering** - Order prints directly

---

## **IMPLEMENTATION NOTES**

### **Component File Structure**
```
/components
  ├── ClientDeliveryPage.tsx (Main component)
  ├── RatingReview.tsx
  ├── RevisionRequest.tsx
  ├── ImageDetailModal.tsx
  ├── BrandLogo.tsx
  └── figma/
      └── ImageWithFallback.tsx
```

### **Integration with Main App**
```typescript
// In App.tsx
const [showClientDelivery, setShowClientDelivery] = useState(false);
const [previewMode, setPreviewMode] = useState(false);

// Preview mode shows banner at top
if (showClientDelivery) {
  return (
    <div className="relative">
      {previewMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-white p-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">Preview Mode - Client Delivery Page</span>
          </div>
          <Button onClick={handleBackFromPreview} variant="secondary" className="h-8 px-4 text-sm rounded-xl">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Job
          </Button>
        </div>
      )}
      <div className={previewMode ? "pt-[52px]" : ""}>
        <ClientDeliveryPage />
      </div>
    </div>
  );
}
```

---

## **CONCLUSION**

This Client Delivery Page represents a complete, production-ready solution for delivering professional media assets to clients. It combines modern design principles with practical functionality, ensuring both photographers and clients have an exceptional experience.

The page emphasizes:
- **Professional presentation** with RPP brand identity
- **Intuitive navigation** with multiple access points
- **Powerful selection system** for bulk operations
- **Comprehensive revision workflow** with comments
- **Responsive design** for all devices
- **Accessibility** for all users

Use this specification as a complete reference for building or replicating the Client Delivery Page functionality in any React-based application.

---

**Version:** 1.0  
**Last Updated:** October 19, 2025  
**Component:** ClientDeliveryPage.tsx  
**Dependencies:** React 18+, ShadCN/UI, Lucide React, Tailwind CSS v4
