import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type {
  BookingFormSettings,
  TeamMember,
  TeamMemberAvailability,
  Appointment,
  BookingProduct,
  AvailableDay,
  TimeSlot,
  DriveTimeResult,
  BookingValidationResult,
  DEFAULT_BOOKING_SETTINGS,
} from './types';

// ============================================================================
// Date & Time Helpers
// ============================================================================

// Normalize any incoming appointmentDate value to a Date instance
function normalizeAppointmentDate(value: any): Date {
  if (value instanceof Date) return value;
  if (!value) return new Date(NaN);
  // Firestore Timestamp-style objects
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  return new Date(value);
}

// Cache Intl.DateTimeFormat instances per time zone for performance
const dateKeyFormatterCache: Record<string, Intl.DateTimeFormat> = {};

// Get a stable YYYY-MM-DD key for a given Date in a given IANA time zone
function getDateKeyInTimeZone(date: Date, timeZone?: string): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  const tz =
    timeZone ||
    (typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined) ||
    'Australia/Sydney';

  let formatter = dateKeyFormatterCache[tz];
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateKeyFormatterCache[tz] = formatter;
  }

  return formatter.format(date); // e.g. "2024-12-16"
}

// ============================================================================
// Partner Booking Configuration
// ============================================================================

/**
 * Hook to fetch and manage partner booking form settings
 */
export function usePartnerBookingConfig(partnerId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch booking settings
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery<BookingFormSettings>({
    queryKey: ['/api/booking/settings', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      if (!partnerId) return getMockBookingSettings('');
      try {
        const response = await apiRequest('/api/booking/settings');
        const data = await response.json();
        // Filter out undefined/null values to not override defaults
        const filteredData = Object.fromEntries(
          Object.entries(data).filter(([_, v]) => v !== undefined && v !== null)
        );
        return {
          ...getMockBookingSettings(partnerId),
          ...filteredData,
          partnerId,
        };
      } catch {
        return getMockBookingSettings(partnerId);
      }
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<BookingFormSettings>) => {
      console.log('[BookingSettings] Saving settings:', newSettings);
      const response = await apiRequest('/api/booking/settings', 'PUT', newSettings);
      const result = await response.json();
      console.log('[BookingSettings] Save response:', result);
      return result;
    },
    onSuccess: () => {
      console.log('[BookingSettings] Save successful, invalidating queries');
      // Invalidate both authenticated and public config caches
      queryClient.invalidateQueries({ queryKey: ['/api/booking/settings', partnerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/booking/public-settings', partnerId] });
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateSettingsMutation.mutate,
    isUpdating: updateSettingsMutation.isPending,
  };
}

/**
 * Hook to fetch booking settings for public booking form (by booking link/partnerId)
 */
export function usePublicBookingConfig(partnerId: string) {
  return useQuery<BookingFormSettings>({
    queryKey: ['/api/booking/public-settings', partnerId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/booking/public-settings/${partnerId}`);
        if (response.ok) {
          const data = await response.json();
          // Merge with defaults to ensure all fields exist
          const defaults = getMockBookingSettings(partnerId);
          
          // Filter out undefined/null values to not override defaults
          const filteredData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined && v !== null)
          );
          
          // In development mode, always enable booking for testing
          const isDevelopment = import.meta.env.DEV;
          
          return {
            ...defaults,
            ...filteredData,
            // Force enable in development mode for testing
            isEnabled: isDevelopment ? true : (data.isEnabled ?? true),
          };
        }
        // API returned error, return mock data
        return getMockBookingSettings(partnerId);
      } catch {
        // Network error or API not available, return mock data
        return getMockBookingSettings(partnerId);
      }
    },
    staleTime: 1000 * 30, // 30 seconds - shorter for faster updates
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
}

// ============================================================================
// Team Availability
// ============================================================================

/**
 * Hook to fetch team members and their availability
 */
export function useTeamAvailability(partnerId: string | undefined) {
  const { data: teamMembers = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/booking/team', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      if (!partnerId) return [];
      try {
        const response = await fetch(`/api/booking/team/${partnerId}`);
        if (response.ok) {
          return await response.json();
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  const { data: availability = [], isLoading: availabilityLoading } = useQuery<TeamMemberAvailability[]>({
    queryKey: ['/api/booking/team-availability', partnerId],
    enabled: !!partnerId && teamMembers.length > 0,
    queryFn: async () => {
      if (!partnerId) return [];
      try {
        const response = await fetch(`/api/booking/team-availability/${partnerId}`);
        if (response.ok) {
          return await response.json();
        }
        // Return mock availability based on team members
        return getMockTeamAvailability(teamMembers);
      } catch {
        return getMockTeamAvailability(teamMembers);
      }
    },
  });

  return {
    teamMembers,
    availability,
    isLoading: membersLoading || availabilityLoading,
  };
}

/**
 * Check if a team member is available at a specific date/time
 */
export function isTeamMemberAvailable(
  teamMemberId: string,
  date: Date,
  time: string,
  duration: number,
  availability: TeamMemberAvailability[],
  appointments: Appointment[],
  timeZone?: string
): boolean {
  const dayOfWeek = date.getDay();
  
  // Check weekly availability
  const memberAvailability = availability.find(
    (a) => a.teamMemberId === teamMemberId && a.dayOfWeek === dayOfWeek
  );
  
  if (!memberAvailability?.isAvailable) {
    return false;
  }

  // Check if time falls within available hours
  const requestedTime = parseTimeToMinutes(time);
  const startTime = parseTimeToMinutes(memberAvailability.startTime);
  const endTime = parseTimeToMinutes(memberAvailability.endTime);
  
  if (requestedTime < startTime || requestedTime + duration > endTime) {
    return false;
  }

  // Check for conflicting appointments
  const dateKey = getDateKeyInTimeZone(date, timeZone);
  const memberAppointments = appointments.filter(
    (a) => {
      const apptDate = normalizeAppointmentDate((a as any).appointmentDate);
      const apptKey = getDateKeyInTimeZone(apptDate, timeZone);
      return (
        a.teamMemberId === teamMemberId &&
        apptKey === dateKey &&
        a.status !== 'cancelled'
      );
    }
  );

  for (const appt of memberAppointments) {
    const apptStart = parseTimeToMinutes(appt.startTime);
    const apptEnd = parseTimeToMinutes(appt.endTime);
    
    // Check for overlap
    if (requestedTime < apptEnd && requestedTime + duration > apptStart) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Appointments
// ============================================================================

/**
 * Hook to fetch existing appointments for scheduling
 */
export function useAppointments(partnerId: string | undefined, dateRange?: { start: Date; end: Date }) {
  return useQuery<Appointment[]>({
    queryKey: ['/api/booking/appointments', partnerId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!partnerId,
    queryFn: async () => {
      if (!partnerId) return [];
      try {
        const params = new URLSearchParams();
        if (dateRange?.start) params.append('start', dateRange.start.toISOString());
        if (dateRange?.end) params.append('end', dateRange.end.toISOString());
        
        const response = await fetch(`/api/booking/appointments/${partnerId}?${params}`);
        if (response.ok) {
          const data = await response.json();
          
          // Log all appointments received from API
          console.log('[BOOKING API] Received appointments from server:', {
            count: data.length,
            dateRange: { start: dateRange?.start?.toISOString(), end: dateRange?.end?.toISOString() },
            appointments: data.map((a: any) => ({
              id: a.id,
              appointmentDate: a.appointmentDate,
              startTime: a.startTime,
              teamMemberId: a.teamMemberId || 'NULL',
              jobId: a.jobId,
              address: a.address
            }))
          });
          
          // Transform appointment dates
          const mapped = data.map((a: any) => ({
            ...a,
            appointmentDate: normalizeAppointmentDate(a.appointmentDate),
          }));

          // Focused debug logging for the Shelly Beach case
          mapped
            .filter(
              (a: any) =>
                typeof a.address === 'string' &&
                a.address.includes('48 Shelly Beach Road')
            )
            .forEach((a: any) => {
              const d = normalizeAppointmentDate(a.appointmentDate);
              console.log('[BOOKING DEBUG] Shelly Beach appointment:', {
                id: a.id,
                raw: a.appointmentDate,
                local: d.toString(),
                iso: d.toISOString(),
                localDateKey: getDateKeyInTimeZone(d),
              });
            });

          return mapped;
        }
        return getMockAppointments(partnerId);
      } catch {
        return getMockAppointments(partnerId);
      }
    },
  });
}

// ============================================================================
// Products
// ============================================================================

/**
 * Hook to fetch products visible on booking form
 */
export function useBookingProducts(partnerId: string) {
  return useQuery<BookingProduct[]>({
    queryKey: ['/api/booking/products', partnerId],
    queryFn: async () => {
      try {
        // Fetch products from the public booking endpoint
        const response = await fetch(`/api/booking/products/${partnerId}`);
        if (response.ok) {
          const products = await response.json();
          return products.map((p: any) => ({
            id: p.id,
            partnerId: p.partnerId,
            title: p.title,
            description: p.description,
            type: p.type,
            category: p.category,
            price: typeof p.price === 'number' ? p.price : parseFloat(p.price || '0'),
            taxRate: typeof p.taxRate === 'number' ? p.taxRate : parseFloat(p.taxRate || '10'),
            hasVariations: p.hasVariations || false,
            variations: p.variations,
            productType: p.productType || 'onsite',
            requiresAppointment: p.requiresAppointment ?? true,
            appointmentDuration: p.appointmentDuration || 60,
            isActive: p.isActive !== false,
            isLive: p.isLive !== false,
            image: p.image,
            availableAddons: p.availableAddons || null,
          }));
        }
        return getMockProducts(partnerId);
      } catch {
        return getMockProducts(partnerId);
      }
    },
  });
}

// ============================================================================
// Drive Time Calculation
// ============================================================================

/**
 * Fetch drive time from API (uses Google Maps Distance Matrix with Haversine fallback)
 */
export async function fetchDriveTime(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<{ durationMinutes: number; distanceKm: number; source: string }> {
  try {
    const response = await fetch(
      `/api/booking/drive-time?originLat=${fromLat}&originLng=${fromLng}&destLat=${toLat}&destLng=${toLng}`
    );
    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    console.error('Drive time API error:', error);
  }
  // Fallback to local calculation
  return calculateDriveTimeLocal(fromLat, fromLng, toLat, toLng);
}

/**
 * Calculate estimated drive time between two locations (local Haversine fallback)
 */
export function calculateDriveTimeLocal(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): { durationMinutes: number; distanceKm: number; source: string } {
  // Haversine formula for distance calculation
  const R = 6371; // Earth's radius in km
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c * 10) / 10;

  // Estimate driving time (average 40km/h in urban areas)
  const durationMinutes = Math.round((distanceKm / 40) * 60);

  return {
    distanceKm,
    durationMinutes,
    source: 'haversine',
  };
}

/**
 * Legacy function for backwards compatibility
 */
export function calculateDriveTime(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  maxDistanceKm: number
): DriveTimeResult {
  const result = calculateDriveTimeLocal(fromLat, fromLng, toLat, toLng);
  return {
    distanceKm: result.distanceKm,
    durationMinutes: result.durationMinutes,
    isWithinLimit: result.distanceKm <= maxDistanceKm,
  };
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if a new appointment conflicts with existing appointments considering:
 * - Service duration of existing appointments
 * - Drive time between locations (using pre-fetched Google Maps data)
 * - Buffer time between appointments
 */
export function checkDriveTimeConflict(
  newAppointment: {
    date: Date;
    time: string;
    duration: number;
    latitude?: number;
    longitude?: number;
  },
  existingAppointments: Appointment[],
  driveTimesMap: Map<string, { durationMinutes: number; distanceKm: number; source?: string }>,
  teamMemberId: string | undefined,
  timeZone?: string,
  maxDriveDistanceKm: number,
  bufferMinutes: number
): { hasConflict: boolean; reason?: string; conflictDetails?: { 
  existingEnd: string; 
  driveTime: number; 
  bufferTime: number; 
  nextAvailable: string 
} } {
  const dateKey = getDateKeyInTimeZone(newAppointment.date, timeZone);
  const newStartMinutes = parseTimeToMinutes(newAppointment.time);
  const newEndMinutes = newStartMinutes + newAppointment.duration;

  // Filter to same-day appointments that aren't cancelled
  // Note: existingAppointments is already filtered by team member before being passed in
  const sameDayAppointments = existingAppointments.filter(
    (a) => {
      const apptDate = normalizeAppointmentDate((a as any).appointmentDate);
      const apptKey = getDateKeyInTimeZone(apptDate, timeZone);
      return apptKey === dateKey && a.status !== 'cancelled';
    }
  );

  for (const appt of sameDayAppointments) {
    const apptStartMinutes = parseTimeToMinutes(appt.startTime);
    // Use actual estimated duration from the appointment, with fallback
    const apptDuration = appt.estimatedDuration || 60;
    const apptEndMinutes = apptStartMinutes + apptDuration;

    // First check: Direct time overlap (regardless of location)
    if (newStartMinutes < apptEndMinutes && newEndMinutes > apptStartMinutes) {
      const existingEndTime = formatMinutesToTime(apptEndMinutes);
      console.log(`[Conflict] Direct time overlap with appointment ${appt.id} at ${appt.address}`);
      return {
        hasConflict: true,
        reason: `Time conflict with existing appointment at ${appt.address?.split(',')[0] || 'another location'} (${formatMinutesToTime(apptStartMinutes)} - ${existingEndTime})`,
        conflictDetails: {
          existingEnd: existingEndTime,
          driveTime: 0,
          bufferTime: 0,
          nextAvailable: existingEndTime
        }
      };
    }

    // Check drive time constraints using pre-fetched data or fallback to local calculation
    let driveTimeData = driveTimesMap.get(appt.id);
    
    // If no pre-fetched data but we have coordinates, use local calculation as fallback
    if (!driveTimeData && newAppointment.latitude && newAppointment.longitude && appt.latitude && appt.longitude) {
      const localCalc = calculateDriveTime(
        appt.latitude,
        appt.longitude,
        newAppointment.latitude,
        newAppointment.longitude,
        maxDriveDistanceKm
      );
      driveTimeData = {
        durationMinutes: localCalc.durationMinutes,
        distanceKm: localCalc.distanceKm,
        source: 'local-fallback'
      };
      console.log(`[DriveTime] Using local fallback for ${appt.id}: ${localCalc.durationMinutes} min`);
    }

    if (driveTimeData) {
      const { durationMinutes: driveMinutes, distanceKm, source } = driveTimeData;
      
      console.log(`[Conflict Check] Appointment ${appt.id}: drive=${driveMinutes}min (${distanceKm}km via ${source || 'unknown'}), buffer=${bufferMinutes}min`);

      // Check if distance exceeds limit (only if appointments are close in time)
      if (distanceKm > maxDriveDistanceKm) {
        if (
          Math.abs(apptEndMinutes - newStartMinutes) < 180 ||
          Math.abs(newEndMinutes - apptStartMinutes) < 180
        ) {
          console.log(`[Conflict] Distance ${distanceKm}km exceeds max ${maxDriveDistanceKm}km`);
          return {
            hasConflict: true,
            reason: `Location ${distanceKm}km away exceeds maximum drive distance of ${maxDriveDistanceKm}km`,
          };
        }
      }

      // Required buffer = drive time + partner's buffer setting
      const requiredBuffer = driveMinutes + bufferMinutes;
      const existingEndTime = formatMinutesToTime(apptEndMinutes);

      // If new appointment comes after existing appointment
      if (newStartMinutes >= apptEndMinutes) {
        const gap = newStartMinutes - apptEndMinutes;
        if (gap < requiredBuffer) {
          const nextAvailableMinutes = apptEndMinutes + requiredBuffer;
          const nextAvailableTime = formatMinutesToTime(nextAvailableMinutes);
          console.log(`[Conflict] Gap ${gap}min < required ${requiredBuffer}min (drive: ${driveMinutes}, buffer: ${bufferMinutes})`);
          return {
            hasConflict: true,
            reason: `Previous job ends at ${existingEndTime}, need ${driveMinutes} min drive + ${bufferMinutes} min buffer. Next available: ${nextAvailableTime}`,
            conflictDetails: {
              existingEnd: existingEndTime,
              driveTime: driveMinutes,
              bufferTime: bufferMinutes,
              nextAvailable: nextAvailableTime
            }
          };
        }
      }

      // If new appointment comes before existing appointment
      if (newEndMinutes <= apptStartMinutes) {
        const gap = apptStartMinutes - newEndMinutes;
        if (gap < requiredBuffer) {
          const latestStartMinutes = apptStartMinutes - requiredBuffer - newAppointment.duration;
          const latestStartTime = formatMinutesToTime(Math.max(0, latestStartMinutes));
          console.log(`[Conflict] Gap before next ${gap}min < required ${requiredBuffer}min`);
          return {
            hasConflict: true,
            reason: `Next job starts at ${formatMinutesToTime(apptStartMinutes)}, need ${driveMinutes} min drive + ${bufferMinutes} min buffer to arrive on time`,
            conflictDetails: {
              existingEnd: formatMinutesToTime(apptStartMinutes),
              driveTime: driveMinutes,
              bufferTime: bufferMinutes,
              nextAvailable: latestStartTime
            }
          };
        }
      }
    } else {
      // No location data at all - just check with buffer time only
      const requiredBuffer = bufferMinutes;
      const existingEndTime = formatMinutesToTime(apptEndMinutes);

      if (newStartMinutes >= apptEndMinutes) {
        const gap = newStartMinutes - apptEndMinutes;
        if (gap < requiredBuffer) {
          const nextAvailableMinutes = apptEndMinutes + requiredBuffer;
          console.log(`[Conflict] No location data, gap ${gap}min < buffer ${bufferMinutes}min`);
          return {
            hasConflict: true,
            reason: `Previous job ends at ${existingEndTime}, need ${bufferMinutes} min buffer`,
            conflictDetails: {
              existingEnd: existingEndTime,
              driveTime: 0,
              bufferTime: bufferMinutes,
              nextAvailable: formatMinutesToTime(nextAvailableMinutes)
            }
          };
        }
      }
    }
  }

  return { hasConflict: false };
}

/**
 * Helper to format minutes from midnight to time string
 */
function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${String(mins).padStart(2, '0')} ${period}`;
}

// ============================================================================
// Drive Time Pre-fetching
// ============================================================================

/**
 * Pre-fetch drive times between a new location and all existing appointments
 * Uses Google Maps Distance Matrix API via server endpoint
 * Falls back to geocoding addresses when coordinates are missing
 */
export function useDriveTimes(
  newLocation: { latitude: number; longitude: number } | undefined,
  appointments: Appointment[]
) {
  return useQuery<Map<string, { durationMinutes: number; distanceKm: number; source: string }>>({
    queryKey: ['drive-times', newLocation?.latitude, newLocation?.longitude, appointments.map(a => a.id).join(',')],
    enabled: !!newLocation?.latitude && !!newLocation?.longitude && appointments.length > 0,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    queryFn: async () => {
      const driveTimesMap = new Map<string, { durationMinutes: number; distanceKm: number; source: string }>();
      
      if (!newLocation?.latitude || !newLocation?.longitude) {
        return driveTimesMap;
      }

      console.log('[DriveTime] Fetching drive times for', appointments.length, 'appointments');

      // Process all appointments - geocode addresses if coordinates are missing
      const batchSize = 5;
      for (let i = 0; i < appointments.length; i += batchSize) {
        const batch = appointments.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (appt) => {
          try {
            // If appointment has coordinates, use them directly
            if (appt.latitude && appt.longitude) {
              const response = await fetch(
                `/api/booking/drive-time?originLat=${appt.latitude}&originLng=${appt.longitude}&destLat=${newLocation.latitude}&destLng=${newLocation.longitude}`
              );
              
              if (response.ok) {
                const data = await response.json();
                console.log(`[DriveTime] ${appt.id}: ${data.durationMinutes} min (${data.distanceKm} km) via ${data.source}`);
                driveTimesMap.set(appt.id, {
                  durationMinutes: data.durationMinutes,
                  distanceKm: data.distanceKm,
                  source: data.source
                });
              }
            } 
            // If no coordinates but has address, use the address-based drive time endpoint
            else if (appt.address) {
              console.log(`[DriveTime] ${appt.id}: No coordinates, using address: ${appt.address}`);
              const response = await fetch(
                `/api/booking/drive-time-address?originAddress=${encodeURIComponent(appt.address)}&destLat=${newLocation.latitude}&destLng=${newLocation.longitude}`
              );
              
              if (response.ok) {
                const data = await response.json();
                console.log(`[DriveTime] ${appt.id}: ${data.durationMinutes} min (${data.distanceKm} km) via ${data.source}`);
                driveTimesMap.set(appt.id, {
                  durationMinutes: data.durationMinutes,
                  distanceKm: data.distanceKm,
                  source: data.source
                });
              } else {
                // If address lookup fails, use a conservative default (30 min)
                console.log(`[DriveTime] ${appt.id}: Address lookup failed, using default 30 min`);
                driveTimesMap.set(appt.id, {
                  durationMinutes: 30,
                  distanceKm: 20,
                  source: 'default-fallback'
                });
              }
            } else {
              // No coordinates and no address - use conservative default
              console.log(`[DriveTime] ${appt.id}: No location data, using default 30 min`);
              driveTimesMap.set(appt.id, {
                durationMinutes: 30,
                distanceKm: 20,
                source: 'default-fallback'
              });
            }
          } catch (error) {
            console.error(`[DriveTime] Error fetching for appointment ${appt.id}:`, error);
            // Fall back to local calculation if we have coords, otherwise default
            if (appt.latitude && appt.longitude) {
              const local = calculateDriveTimeLocal(appt.latitude, appt.longitude, newLocation.latitude, newLocation.longitude);
              driveTimesMap.set(appt.id, local);
            } else {
              driveTimesMap.set(appt.id, {
                durationMinutes: 30,
                distanceKm: 20,
                source: 'error-fallback'
              });
            }
          }
        }));
      }

      console.log('[DriveTime] Fetched drive times for', driveTimesMap.size, 'appointments');
      return driveTimesMap;
    }
  });
}

// ============================================================================
// Available Time Slots
// ============================================================================

/**
 * Generate available time slots for a given date
 * Takes into account:
 * - Team member availability
 * - Existing appointment durations
 * - Drive time between locations (via Google Maps API)
 * - Buffer time between appointments
 */
export function useAvailableTimeSlots(
  partnerId: string,
  date: Date | null,
  duration: number,
  teamMemberId?: string,
  newLocation?: { latitude: number; longitude: number }
) {
  const { teamMembers, availability, isLoading: teamLoading } = useTeamAvailability(partnerId);
  const { data: appointments = [] } = useAppointments(partnerId, date ? {
    start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59),
  } : undefined);
  const { data: settings } = usePublicBookingConfig(partnerId);
  
  // Pre-fetch drive times from Google Maps API
  const { data: driveTimesMap, isLoading: driveTimesLoading } = useDriveTimes(newLocation, appointments);

  const slots = useMemo(() => {
    if (!date || !settings) return [];

    const dayOfWeek = date.getDay();
    const now = new Date();
    const timeZone =
      settings?.timeZone ||
      (typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined) ||
      'Australia/Sydney';
    const isToday =
      getDateKeyInTimeZone(date, timeZone) === getDateKeyInTimeZone(now, timeZone);
    const minLeadTime = (settings.minLeadTimeHours || 24) * 60; // Convert to minutes
    const bufferMinutes = settings.bufferMinutes || 15;
    const maxDriveDistanceKm = settings.maxDriveDistanceKm || 50;
    const serviceDuration = duration || 60;
    const timeSlotInterval = settings.timeSlotInterval || 30; // Default 30 minutes

    // Filter appointments by teamMemberId if one is selected
    // This ensures we only check conflicts for the selected photographer
    const filteredAppointments = teamMemberId 
      ? appointments.filter(a => a.teamMemberId === teamMemberId)
      : appointments;

    // CRITICAL DIAGNOSTIC: Show exactly why appointments are filtered out
    if (teamMemberId && appointments.length > 0 && filteredAppointments.length === 0) {
      console.error('🚨 [FILTERING ISSUE] No appointments matched the selected team member!', {
        selectedTeamMemberId: teamMemberId,
        totalAppointments: appointments.length,
        filteredAppointments: filteredAppointments.length,
        whyNoMatch: appointments.map(a => ({
          appointmentId: a.id,
          appointmentDate: a.appointmentDate?.toISOString(),
          startTime: a.startTime,
          storedTeamMemberId: a.teamMemberId || 'NULL/UNDEFINED',
          storedTeamMemberIdType: typeof a.teamMemberId,
          selectedTeamMemberId: teamMemberId,
          selectedTeamMemberIdType: typeof teamMemberId,
          matches: a.teamMemberId === teamMemberId,
          reason: !a.teamMemberId 
            ? '❌ Appointment has no teamMemberId (NULL/UNDEFINED)'
            : a.teamMemberId !== teamMemberId
            ? `❌ ID mismatch: stored="${a.teamMemberId}" vs selected="${teamMemberId}"`
            : '✅ Should match but doesn\'t?'
        }))
      });
    }

    // Debug logging
    console.log('[TimeSlots] Generating slots for', date.toDateString());
    console.log('[TimeSlots] Settings:', { 
      bufferMinutes, 
      maxDriveDistanceKm, 
      serviceDuration, 
      timeSlotInterval,
      hasNewLocation: !!newLocation,
      teamMemberId 
    });
    console.log('[TimeSlots] All appointments:', appointments.length, 'on this day');
    console.log('[TimeSlots] Filtered appointments (by teamMemberId):', filteredAppointments.length);
    console.log('[TimeSlots] Drive times available:', driveTimesMap?.size || 0);

    // Detailed ID comparison debugging
    appointments.forEach(a => {
      const matches = a.teamMemberId === teamMemberId;
      const storedId = a.teamMemberId || 'NULL/UNDEFINED';
      const selectedId = teamMemberId || 'NULL/UNDEFINED';
      
      // Very prominent warning for mismatches
      if (!matches && teamMemberId) {
        console.warn('⚠️ [ID MISMATCH DETECTED]', {
          'Appointment ID': a.id,
          'Appointment Date': a.appointmentDate?.toISOString(),
          'Start Time': a.startTime,
          'Stored Team Member ID': storedId,
          'Selected Team Member ID': selectedId,
          'Match': '❌ NO MATCH',
          'Lengths': {
            stored: storedId?.toString().length,
            selected: selectedId?.toString().length
          },
          'Character Comparison': {
            storedFirst: storedId?.toString().charAt(0),
            selectedFirst: selectedId?.toString().charAt(0),
            storedLast: storedId?.toString().charAt(-1),
            selectedLast: selectedId?.toString().charAt(-1)
          }
        });
      }
      
      console.log('[ID COMPARISON] Appointment:', {
        appointmentId: a.id,
        storedTeamMemberId: a.teamMemberId,
        storedTeamMemberIdFormatted: a.teamMemberId ? `"${a.teamMemberId}"` : 'null/undefined',
        selectedTeamMemberId: teamMemberId,
        selectedTeamMemberIdFormatted: teamMemberId ? `"${teamMemberId}"` : 'null/undefined',
        matches: matches,
        startTime: a.startTime,
        date: a.appointmentDate?.toISOString()
      });
      console.log('[ID COMPARISON] String comparison:', {
        stored: `"${a.teamMemberId || 'NULL'}"`,
        selected: `"${teamMemberId || 'NULL'}"`,
        areEqual: matches
      });
    });
    
    console.log('[TimeSlots] ID COMPARISON SUMMARY:', {
      selectedTeamMemberId: teamMemberId,
      allAppointmentsCount: appointments.length,
      filteredAppointmentsCount: filteredAppointments.length,
      appointmentDetails: appointments.map(a => ({
        appointmentId: a.id,
        storedTeamMemberId: a.teamMemberId,
        storedTeamMemberIdType: typeof a.teamMemberId,
        storedTeamMemberIdValue: a.teamMemberId ? `"${a.teamMemberId}"` : 'null/undefined',
        selectedTeamMemberId: teamMemberId,
        selectedTeamMemberIdType: typeof teamMemberId,
        selectedTeamMemberIdValue: teamMemberId ? `"${teamMemberId}"` : 'null/undefined',
        matches: a.teamMemberId === teamMemberId,
        strictEquals: a.teamMemberId === teamMemberId,
        startTime: a.startTime,
        date: a.appointmentDate?.toISOString()
      }))
    });

    // Generate time slots based on configurable interval (from 7 AM to 7 PM)
    const allSlots: TimeSlot[] = [];
    
    // Check if day is a work day (not Sunday)
    if (dayOfWeek === 0) {
      // Sunday - no slots
      return [];
    }
    
    // Generate minutes based on the interval setting
    const startMinutes = 7 * 60; // 7:00 AM
    const endMinutes = 19 * 60;  // 7:00 PM
    
    for (let minutesFromMidnight = startMinutes; minutesFromMidnight < endMinutes; minutesFromMidnight += timeSlotInterval) {
      const hour = Math.floor(minutesFromMidnight / 60);
      const minute = minutesFromMidnight % 60;
      const timeStr = formatTime(hour, minute);
        
        // Check minimum lead time
        if (isToday) {
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          if (minutesFromMidnight < nowMinutes + minLeadTime) {
            allSlots.push({
              time: timeStr,
              available: false,
              conflictReason: 'Too soon - minimum booking notice required',
            });
            continue;
          }
        }

        // If no team members loaded yet, assume all slots are available
        if (teamMembers.length === 0) {
          allSlots.push({
            time: timeStr,
            available: true,
            teamMemberIds: [],
          });
          continue;
        }

        // Find available team members for this slot
        const availableTeamMembers: string[] = [];
        let lastConflictReason: string | undefined;
        
        const membersToCheck = teamMemberId 
          ? teamMembers.filter(m => m.id === teamMemberId)
          : teamMembers;

        // Team member debugging
        console.log('[TimeSlots] TEAM MEMBER DEBUG:', {
          selectedTeamMemberId: teamMemberId,
          allTeamMembers: teamMembers.map(m => ({
            id: m.id,
            idType: typeof m.id,
            idValue: `"${m.id}"`,
            name: m.name,
            role: m.role,
            matchesSelected: m.id === teamMemberId
          })),
          membersToCheck: membersToCheck.map(m => ({
            id: m.id,
            name: m.name
          }))
        });

        for (const member of membersToCheck) {
          // Check if team member is available based on weekly availability
          const memberAvailability = availability.find(
            (a) => a.teamMemberId === member.id && a.dayOfWeek === dayOfWeek
          );
          
          if (!memberAvailability?.isAvailable) {
            lastConflictReason = `${member.name || 'Team member'} not working this day`;
            continue;
          }

          // Check if time falls within working hours
          const workStart = parseTimeToMinutes(memberAvailability.startTime);
          const workEnd = parseTimeToMinutes(memberAvailability.endTime);
          if (minutesFromMidnight < workStart || minutesFromMidnight + serviceDuration > workEnd) {
            lastConflictReason = 'Outside working hours';
            continue;
          }

          // Check for conflicts with existing appointments (including service duration + drive time + buffer)
          // Use filtered appointments to only check conflicts for this specific team member
            const memberAppointments = filteredAppointments.filter(a => a.teamMemberId === member.id);
          const conflict = checkDriveTimeConflict(
            { 
              date, 
              time: timeStr, 
              duration: serviceDuration, 
              latitude: newLocation?.latitude,
              longitude: newLocation?.longitude
            },
            memberAppointments,
            driveTimesMap || new Map(),
            member.id,
              timeZone,
            maxDriveDistanceKm,
            bufferMinutes
          );

          if (conflict.hasConflict) {
            lastConflictReason = conflict.reason;
          } else {
            availableTeamMembers.push(member.id);
          }
        }

        allSlots.push({
          time: timeStr,
          available: availableTeamMembers.length > 0,
          teamMemberIds: availableTeamMembers,
          conflictReason: availableTeamMembers.length === 0 ? lastConflictReason || 'No team members available' : undefined,
        });
      }

    return allSlots;
  }, [date, duration, teamMemberId, newLocation, teamMembers, availability, appointments, settings, driveTimesMap]);

  return { slots, isLoading: driveTimesLoading };
}

// ============================================================================
// Booking Validation
// ============================================================================

/**
 * Validate booking form data
 */
export function validateBooking(
  formData: {
    contact: string;
    contactType: 'email' | 'phone';
    address: string;
    selectedProducts: { duration: number }[];
    preferredDate: string;
    preferredTime: string;
  },
  settings: BookingFormSettings
): BookingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate contact
  if (!formData.contact) {
    errors.push('Contact information is required');
  } else if (formData.contactType === 'email' && !isValidEmail(formData.contact)) {
    errors.push('Please enter a valid email address');
  } else if (formData.contactType === 'phone' && !isValidPhone(formData.contact)) {
    errors.push('Please enter a valid phone number');
  }

  // Validate address
  if (!formData.address) {
    errors.push('Property address is required');
  }

  // Validate products selected
  if (formData.selectedProducts.length === 0) {
    errors.push('Please select at least one service');
  }

  // Validate date/time
  if (!formData.preferredDate) {
    errors.push('Please select a date');
  }
  if (!formData.preferredTime) {
    errors.push('Please select a time');
  }

  // Check minimum lead time
  if (formData.preferredDate && formData.preferredTime) {
    const appointmentDate = new Date(`${formData.preferredDate}T${convertTo24Hour(formData.preferredTime)}`);
    const now = new Date();
    const hoursDiff = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff < settings.minLeadTimeHours) {
      errors.push(`Bookings must be made at least ${settings.minLeadTimeHours} hours in advance`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseTimeToMinutes(time: string): number {
  // Handle both "8:00 AM" and "13:00" (24-hour) formats
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3]?.toUpperCase();
  
  // If period is provided, it's 12-hour format
  if (period) {
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  }
  // If no period and hours > 12, it's already in 24-hour format, use as-is
  // If no period and hours <= 12, assume it's 24-hour format (0-23)
  
  return hours * 60 + minutes;
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

function convertTo24Hour(time: string): string {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return '00:00';
  
  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  return /^[\d\s\-+()]{10,}$/.test(phone);
}

// ============================================================================
// Mock Data (for development)
// ============================================================================

function getMockBookingSettings(partnerId: string): BookingFormSettings {
  return {
    partnerId,
    isEnabled: true,
    bookingLink: `https://app.rppcentral.com/book/${partnerId}`,
    allowNewClients: true,
    requireExistingCustomer: false,
    minLeadTimeHours: 24,
    maxDriveDistanceKm: 50,
    bufferMinutes: 30,
    timeSlotInterval: 30,
    allowTeamSelection: true,
    paymentEnabled: false,
    paymentMethod: 'invoice',
    depositEnabled: false,
    depositType: 'percentage',
    depositAmount: 25,
    customQuestions: [
      {
        id: 'property-type',
        question: 'What type of property is this?',
        type: 'select',
        options: ['Residential', 'Commercial', 'Land', 'Multi-family'],
        required: true,
        order: 1,
      },
      {
        id: 'listing-agent',
        question: 'Listing agent name (if applicable)',
        type: 'text',
        required: false,
        order: 2,
      },
    ],
  };
}

function getMockTeamAvailability(teamMembers: TeamMember[]): TeamMemberAvailability[] {
  const availability: TeamMemberAvailability[] = [];
  
  teamMembers.forEach((member) => {
    // Monday to Friday, 8 AM to 6 PM
    for (let day = 1; day <= 5; day++) {
      availability.push({
        teamMemberId: member.id,
        dayOfWeek: day,
        isAvailable: true,
        startTime: '08:00',
        endTime: '18:00',
      });
    }
    // Saturday, 9 AM to 2 PM
    availability.push({
      teamMemberId: member.id,
      dayOfWeek: 6,
      isAvailable: true,
      startTime: '09:00',
      endTime: '14:00',
    });
    // Sunday - not available
    availability.push({
      teamMemberId: member.id,
      dayOfWeek: 0,
      isAvailable: false,
      startTime: '00:00',
      endTime: '00:00',
    });
  });
  
  return availability;
}

function getMockAppointments(partnerId: string): Appointment[] {
  const today = new Date();
  
  return [
    {
      id: 'mock-apt-1',
      jobId: 'job-001',
      partnerId,
      teamMemberId: 'team-1',
      address: '123 Sample St, Sydney NSW 2000',
      latitude: -33.8688,
      longitude: 151.2093,
      appointmentDate: today,
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      estimatedDuration: 60,
      status: 'scheduled',
    },
    {
      id: 'mock-apt-2',
      jobId: 'job-002',
      partnerId,
      teamMemberId: 'team-1',
      address: '456 Example Ave, Sydney NSW 2001',
      latitude: -33.8700,
      longitude: 151.2100,
      appointmentDate: today,
      startTime: '2:00 PM',
      endTime: '3:30 PM',
      estimatedDuration: 90,
      status: 'scheduled',
    },
  ];
}

function getMockProducts(partnerId: string): BookingProduct[] {
  return [
    {
      id: 'prod-1',
      partnerId,
      title: 'Starter Package',
      description: '8 Internal & External Photos, 2 Drone Photos, 2D Floor Plan',
      type: 'package',
      category: 'package',
      price: 145,
      taxRate: 10,
      hasVariations: false,
      productType: 'onsite',
      requiresAppointment: true,
      appointmentDuration: 45,
      isActive: true,
      isLive: true,
    },
    {
      id: 'prod-2',
      partnerId,
      title: 'Photography',
      description: 'Professional property photography',
      type: 'product',
      category: 'photo',
      price: 145,
      taxRate: 10,
      hasVariations: true,
      variations: [
        { name: '8 Photos', price: 145, appointmentDuration: 30 },
        { name: '12 Photos', price: 195, appointmentDuration: 45 },
        { name: '20 Photos', price: 295, appointmentDuration: 60 },
      ],
      productType: 'onsite',
      requiresAppointment: true,
      appointmentDuration: 30,
      isActive: true,
      isLive: true,
    },
    {
      id: 'prod-3',
      partnerId,
      title: 'Video Tour',
      description: 'HD property video tour',
      type: 'product',
      category: 'video',
      price: 280,
      taxRate: 10,
      hasVariations: false,
      productType: 'onsite',
      requiresAppointment: true,
      appointmentDuration: 60,
      isActive: true,
      isLive: true,
    },
    {
      id: 'prod-4',
      partnerId,
      title: 'Virtual Staging',
      description: 'Transform empty rooms digitally',
      type: 'addon',
      category: 'addon',
      price: 45,
      taxRate: 10,
      hasVariations: false,
      productType: 'digital',
      requiresAppointment: false,
      appointmentDuration: 0,
      isActive: true,
      isLive: true,
    },
  ];
}

