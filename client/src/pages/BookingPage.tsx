import { useParams } from "wouter";
import { BookingForm } from "@/components/booking";

/**
 * Public booking page accessible via permanent link
 * Route: /book/:partnerId
 */
export default function BookingPage() {
  const params = useParams<{ partnerId: string }>();
  const partnerId = params.partnerId;

  if (!partnerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Invalid Booking Link</h1>
          <p className="text-gray-500">
            This booking link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  return <BookingForm partnerId={partnerId} />;
}

