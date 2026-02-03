import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { setMasterViewPartnerId } from '@/lib/queryClient';

interface Partner {
  partnerId: string;
  businessName: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface MasterViewContextType {
  // The partnerId being viewed (null means no business selected)
  viewingPartnerId: string | null;
  viewingPartnerName: string | null;
  // List of all available partners
  partners: Partner[];
  partnersLoading: boolean;
  // Whether master view is active (user is master AND viewing a business)
  isMasterViewActive: boolean;
  // Whether user has master role
  isMaster: boolean;
  // Whether currently switching between businesses (for loading animation)
  isSwitchingBusiness: boolean;
  // Whether master is viewing their own business (full access)
  isViewingOwnBusiness: boolean;
  // Whether master is in read-only mode (viewing another business)
  // Use this to disable upload, delete, and edit operations
  isReadOnly: boolean;
  // Methods
  selectPartner: (partnerId: string) => void;
  clearSelection: () => void;
  // Helper to append viewingPartnerId to API URLs
  getApiUrl: (baseUrl: string) => string;
  // Helper to get query key suffix for proper cache invalidation
  getQueryKeySuffix: () => string[];
}

const MasterViewContext = createContext<MasterViewContextType | undefined>(undefined);

/**
 * Default values returned when useMasterView is called outside MasterViewProvider.
 * 
 * Security Note: isReadOnly defaults to true (restrictive) for defense-in-depth.
 * If the provider is missing, we assume the safest posture: deny write operations.
 * This prevents accidental data modification if components are rendered outside
 * the proper provider hierarchy. The server-side APIs also enforce permissions,
 * so this is an additional client-side safeguard.
 * 
 * isMaster defaults to false, meaning the user won't be treated as a master user.
 */
const defaultMasterViewValue: MasterViewContextType = {
  viewingPartnerId: null,
  viewingPartnerName: null,
  partners: [],
  partnersLoading: false,
  isMasterViewActive: false,
  isMaster: false,
  isSwitchingBusiness: false,
  isViewingOwnBusiness: false,
  isReadOnly: true, // Secure default: deny writes when provider is missing
  selectPartner: () => {},
  clearSelection: () => {},
  getApiUrl: (baseUrl: string) => baseUrl,
  getQueryKeySuffix: () => [],
};

/**
 * Hook to access MasterView context.
 * 
 * IMPORTANT: This hook should be used within a MasterViewProvider.
 * If used outside the provider, it returns secure default values:
 * - isMaster: false (user is not treated as master)
 * - isReadOnly: true (write operations are blocked for safety)
 * 
 * The secure default of isReadOnly: true ensures that if the provider is
 * somehow missing, the UI will be restrictive rather than permissive.
 * This follows the principle of "fail secure" - deny by default.
 * 
 * Components using this hook:
 * - FileGallery (for isReadOnly check)
 * - ProtectedRoute (for isMaster, isViewingOwnBusiness)
 * - Header (for business selector dropdown)
 * - Sidebar (for navigation permissions)
 * 
 * @returns MasterViewContextType with either the provider's value or secure defaults
 */
export const useMasterView = (): MasterViewContextType => {
  const context = useContext(MasterViewContext);
  if (context === undefined) {
    // Return secure defaults instead of throwing - allows components to work
    // outside the provider (e.g., in tests, Storybook, or isolated rendering)
    // with isReadOnly: true to prevent accidental write operations
    if (process.env.NODE_ENV === 'development') {
      console.warn('useMasterView called outside MasterViewProvider - using secure defaults (isReadOnly: true)');
    }
    return defaultMasterViewValue;
  }
  return context;
};

interface MasterViewProviderProps {
  children: ReactNode;
}

export const MasterViewProvider: React.FC<MasterViewProviderProps> = ({ children }) => {
  // Use useContext directly to avoid throwing error if AuthProvider is not available
  // This allows MasterViewProvider to work in editor routes that use EditorAuthProvider
  const authContext = useContext(AuthContext);
  const userData = authContext?.userData || null;
  const userRole = authContext?.userRole || null;
  const currentUser = authContext?.currentUser || null;
  
  const [viewingPartnerId, setViewingPartnerId] = useState<string | null>(null);
  const [viewingPartnerName, setViewingPartnerName] = useState<string | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [isSwitchingBusiness, setIsSwitchingBusiness] = useState(false);

  const isMaster = userRole === 'master';
  const ownPartnerId = isMaster ? (userData?.partnerId || null) : null;

  // Fetch partners list when user is master
  useEffect(() => {
    const fetchPartners = async () => {
      if (!isMaster || !currentUser) return;

      setPartnersLoading(true);
      try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/master/partners', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setPartners(data);
          
          // Auto-select own business if available, otherwise first partner
          if (data.length > 0 && !viewingPartnerId) {
            let initialPartner: Partner | undefined;

            if (ownPartnerId) {
              initialPartner = data.find((p: Partner) => p.partnerId === ownPartnerId);
            }

            if (!initialPartner) {
              initialPartner = data[0];
            }

            if (initialPartner) {
              setViewingPartnerId(initialPartner.partnerId);
              setViewingPartnerName(initialPartner.businessName);
            }
          }
        } else {
          console.error('Failed to fetch partners:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching partners:', error);
      } finally {
        setPartnersLoading(false);
      }
    };

    fetchPartners();
  }, [isMaster, currentUser, ownPartnerId, viewingPartnerId]);

  // Clear selection when user logs out or changes
  useEffect(() => {
    if (!currentUser || !isMaster) {
      setViewingPartnerId(null);
      setViewingPartnerName(null);
      setPartners([]);
    }
  }, [currentUser, isMaster]);

  // Sync viewingPartnerId with queryClient for automatic API parameter injection
  useEffect(() => {
    if (isMaster) {
      setMasterViewPartnerId(viewingPartnerId);
    } else {
      setMasterViewPartnerId(null);
    }
  }, [viewingPartnerId, isMaster]);

  const selectPartner = (partnerId: string) => {
    const partner = partners.find(p => p.partnerId === partnerId);
    if (partner && partnerId !== viewingPartnerId) {
      // Start the switching animation
      setIsSwitchingBusiness(true);
      setViewingPartnerId(partnerId);
      setViewingPartnerName(partner.businessName);
      
      // Clear switching state after a delay to allow data to refetch
      setTimeout(() => {
        setIsSwitchingBusiness(false);
      }, 800);
    }
  };

  const clearSelection = () => {
    setViewingPartnerId(null);
    setViewingPartnerName(null);
  };

  // Helper to append viewingPartnerId to API URLs for master view
  const getApiUrl = (baseUrl: string): string => {
    if (!isMaster || !viewingPartnerId) {
      return baseUrl;
    }
    
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}viewingPartnerId=${encodeURIComponent(viewingPartnerId)}`;
  };

  // Helper to get query key suffix for proper cache separation per business
  const getQueryKeySuffix = (): string[] => {
    if (!isMaster || !viewingPartnerId) {
      return [];
    }
    return [`masterView:${viewingPartnerId}`];
  };

  // Determine if master is viewing their own business
  const isViewingOwnBusiness =
    isMaster && !!viewingPartnerId && !!ownPartnerId && viewingPartnerId === ownPartnerId;

  // Master is read-only only when viewing other partners' businesses
  const isReadOnly = isMaster && !!viewingPartnerId && !isViewingOwnBusiness;

  const value: MasterViewContextType = {
    viewingPartnerId: isMaster ? viewingPartnerId : null,
    viewingPartnerName: isMaster ? viewingPartnerName : null,
    partners,
    partnersLoading,
    isMasterViewActive: isMaster && !!viewingPartnerId,
    isMaster,
    isSwitchingBusiness,
    isViewingOwnBusiness,
    isReadOnly,
    selectPartner,
    clearSelection,
    getApiUrl,
    getQueryKeySuffix
  };

  return (
    <MasterViewContext.Provider value={value}>
      {children}
      
      {/* Loading overlay when switching businesses */}
      {isSwitchingBusiness && (
        <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300">
          <div className="flex flex-col items-center gap-4">
            {/* Animated spinner */}
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin" />
            </div>
            {/* Loading text */}
            <div className="text-center">
              <p className="text-lg font-medium text-amber-800">Switching Business</p>
              <p className="text-sm text-amber-600 mt-1">
                Loading {viewingPartnerName || 'business'} data...
              </p>
            </div>
          </div>
        </div>
      )}
    </MasterViewContext.Provider>
  );
};

