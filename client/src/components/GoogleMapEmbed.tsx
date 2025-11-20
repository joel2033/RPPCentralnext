import { cn } from "@/lib/utils";

interface GoogleMapEmbedProps {
  address: string;
  height?: string;
  width?: string;
  className?: string;
}

export default function GoogleMapEmbed({
  address,
  height,
  width = "100%",
  className = ""
}: GoogleMapEmbedProps) {
  // Get the Google Maps API key from environment variables
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

  const containerClass = cn(
    "relative overflow-hidden rounded-xl bg-muted",
    !height && "aspect-video",
    className
  );

  const containerStyle = {
    width,
    ...(height ? { height } : {}),
  } as React.CSSProperties;
  
  if (!apiKey || apiKey.trim() === '') {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-xl border border-red-200 bg-red-50",
          !height && "aspect-video",
          className
        )}
        style={containerStyle}
      >
        <div className="text-center p-4">
          <p className="text-red-700 font-medium">Google Maps API key not configured</p>
          <p className="text-sm text-red-600 mt-1">VITE_GOOGLE_MAPS_API_KEY is missing or empty</p>
          <p className="text-xs text-red-500 mt-1">Check Replit Secrets configuration</p>
        </div>
      </div>
    );
  }

  if (!address || address.trim() === "") {
    return (
      <div 
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-xl bg-muted",
          !height && "aspect-video",
          className
        )}
        style={containerStyle}
      >
        <div className="text-center p-4">
          <p className="text-gray-600">No address provided</p>
        </div>
      </div>
    );
  }

  // Encode the address for the Google Maps Embed API
  const encodedAddress = encodeURIComponent(address.trim());
  
  // Construct the Google Maps Embed URL
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}&zoom=16`;

  return (
    <div className={containerClass} style={containerStyle}>
      <iframe
        src={mapUrl}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`Map showing ${address}`}
        className="absolute inset-0 h-full w-full"
        onError={(e) => {
          console.warn('Google Maps iframe failed to load:', e);
        }}
      />
      
      {/* Fallback overlay in case map fails to load */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted/70 opacity-0 transition-opacity hover:opacity-100">
        <div className="p-2 text-center text-xs text-muted-foreground">
          <p>Click to open in Google Maps</p>
        </div>
      </div>
    </div>
  );
}