interface GoogleMapEmbedProps {
  address: string;
  height?: string;
  width?: string;
  className?: string;
}

export default function GoogleMapEmbed({ 
  address, 
  height = "300px", 
  width = "100%", 
  className = "" 
}: GoogleMapEmbedProps) {
  // Get the Google Maps API key from environment variables
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  
  if (!apiKey) {
    return (
      <div 
        className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}
        style={{ height, width }}
      >
        <div className="text-center p-4">
          <p className="text-gray-600">Google Maps API key not configured</p>
          <p className="text-sm text-gray-500 mt-1">Add VITE_GOOGLE_MAPS_KEY to environment</p>
        </div>
      </div>
    );
  }

  if (!address || address.trim() === "") {
    return (
      <div 
        className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}
        style={{ height, width }}
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
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <iframe
        src={mapUrl}
        width={width}
        height={height}
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`Map showing ${address}`}
        className="w-full"
      />
    </div>
  );
}