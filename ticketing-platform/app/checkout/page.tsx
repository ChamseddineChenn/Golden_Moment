'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { paymentsAPI, seatsAPI } from '@/lib/api';
import Link from 'next/link';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
);

// Checkout Form Component
function CheckoutForm({
  clientSecret,
  eventName,
  totalAmount,
  ticketCount,
  eventId,
  reservedSeats,
}: {
  clientSecret: string;
  eventName: string;
  totalAmount: number;
  ticketCount: number;
  eventId: string;
  reservedSeats: { sectionId: string; seatId: string }[] | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError('Payment system not loaded. Please refresh the page.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        // Format the error message based on error type
        let errorMessage = submitError.message || 'Payment validation failed';
        if (submitError.code === 'incomplete_cvc') {
          errorMessage = 'Please enter a valid CVC code';
        } else if (submitError.code === 'incomplete_expiry') {
          errorMessage = 'Please enter a valid expiration date';
        } else if (submitError.code === 'incomplete_number') {
          errorMessage = 'Please enter a valid card number';
        }
        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      // Confirm payment with Stripe
      const { error: confirmError, paymentIntent } =
        await stripe.confirmPayment({
          elements,
          clientSecret,
          redirect: 'if_required',
        });

      if (confirmError) {
        // Format error message based on error type
        let errorMessage =
          confirmError.message || 'Payment confirmation failed';

        if (confirmError.code === 'card_declined') {
          errorMessage = 'Your card was declined. Please try a different card.';
        } else if (confirmError.code === 'processing_error') {
          errorMessage =
            'An error occurred while processing your card. Please try again.';
        } else if (confirmError.code === 'rate_limit') {
          errorMessage =
            'Too many requests. Please wait a moment and try again.';
        } else if (confirmError.code === 'authentication_error') {
          errorMessage =
            'Authentication failed. Please check your card details.';
        } else if (confirmError.message?.includes('402')) {
          errorMessage =
            'Payment Required: Your card was not accepted. Please try a different payment method.';
        }

        console.error('Payment confirmation error:', {
          code: confirmError.code,
          message: confirmError.message,
          type: confirmError.type,
          param: confirmError.param,
        });

        setError(errorMessage);
        setIsLoading(false);

        // Release reserved seats on payment error
        if (eventId && reservedSeats && reservedSeats.length > 0) {
          seatsAPI
            .releaseReservation(eventId, reservedSeats)
            .catch((err: unknown) => {
              console.warn(
                '[Checkout] Failed to release seats after payment error:',
                err,
              );
            });
        }
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        // Payment successful - fetch the payment document ID from backend
        setPaymentSucceeded(true); // Mark payment as succeeded to prevent seat release on unmount
        try {
          const backendUrl =
            process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
          const paymentResponse = await fetch(
            `${backendUrl}/payments/by-intent/${paymentIntent.id}`,
          );
          const paymentData = await paymentResponse.json();
          const mongoPaymentId = paymentData.data?._id || paymentIntent.id;
          router.push(`/checkout/success?paymentId=${mongoPaymentId}`);
        } catch {
          // Fallback to using Stripe payment intent ID if lookup fails
          router.push(`/checkout/success?paymentId=${paymentIntent.id}`);
        }
      } else if (paymentIntent?.status === 'requires_action') {
        setError(
          'Additional verification required. Please complete the authentication.',
        );
      } else {
        setError('Payment processing failed. Please try again.');
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('Checkout error:', errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
        <div className="space-y-2 mb-4 border-b pb-4">
          <div className="flex justify-between">
            <span>Event:</span>
            <span className="font-medium">{eventName}</span>
          </div>
          <div className="flex justify-between">
            <span>Tickets:</span>
            <span className="font-medium">{ticketCount}</span>
          </div>
        </div>
        <div className="flex justify-between text-lg font-bold text-amber-600">
          <span>Total Amount:</span>
          <span>${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
        <PaymentElement />
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-red-700 font-semibold mb-1">Payment Error</h3>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isLoading}
        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded transition"
      >
        {isLoading ? 'Processing...' : `Pay $${totalAmount.toFixed(2)}`}
      </button>

      <Link href="/" className="text-center text-blue-600 hover:underline">
        Cancel & Return Home
      </Link>
    </form>
  );
}

// Checkout Content Component
function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initializingRef = useRef(false); // Guard against double initialization
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<{
    eventName: string;
    totalAmount: number;
    ticketCount: number;
  } | null>(null);
  const [reservedSeats, setReservedSeats] = useState<
    { sectionId: string; seatId: string }[] | null
  >(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);

  // Release reservation if user leaves checkout or payment fails/cancels
  // BUT NOT if payment succeeded (seats already locked on backend)
  useEffect(() => {
    return () => {
      // Cleanup on unmount - release reserved seats if user navigates away
      // UNLESS payment already succeeded (in which case seats are already finalized)
      if (
        !paymentSucceeded &&
        eventId &&
        reservedSeats &&
        reservedSeats.length > 0
      ) {
        // Send release request (don't await - best effort)
        seatsAPI
          .releaseReservation(eventId, reservedSeats)
          .catch((err: unknown) => {
            console.warn('[Checkout] Failed to release seat reservation:', err);
          });
      }
    };
  }, [eventId, reservedSeats, paymentSucceeded]);

  useEffect(() => {
    const initializeCheckout = async () => {
      // Guard against double initialization
      if (initializingRef.current) {
        console.log(
          '[Checkout] Initialization already in progress, skipping...',
        );
        return;
      }

      initializingRef.current = true;
      try {
        // Get checkout data from search params or session
        const eventId = searchParams.get('eventId');
        const ticketIds = searchParams.get('ticketIds');
        const totalAmount = searchParams.get('totalAmount');
        const eventName = searchParams.get('eventName');
        const buyerEmail = searchParams.get('buyerEmail');
        const buyerName = searchParams.get('buyerName');
        const buyerPhoneNumber = searchParams.get('buyerPhoneNumber');
        const ticketType = searchParams.get('ticketType');

        // Note: totalAmount can be 0 for free tickets
        if (
          !eventId ||
          !ticketIds ||
          totalAmount === null ||
          totalAmount === undefined
        ) {
          setError(
            'Missing checkout information. Please start from the event page.',
          );
          setLoading(false);
          return;
        }

        // If free ticket (totalAmount 0), bypass Stripe and issue directly
        const totalAmountNum = parseFloat(totalAmount);
        if (totalAmountNum === 0) {
          try {
            console.log(
              '[Checkout] Free ticket detected, creating directly...',
            );
            const response = await paymentsAPI.createFreeTicket({
              eventId,
              ticketIds: JSON.parse(ticketIds),
              buyerEmail,
              buyerName,
              buyerPhoneNumber,
              ticketType,
            });
            console.log('[Checkout] Free ticket created:', response.data);
            // Redirect to receipt/confirmation
            router.push(`/receipt/${response.data.data.ticketId}`);
            return;
          } catch (err) {
            console.error('[Checkout] Failed to create free ticket:', err);
            setError(
              err instanceof Error
                ? err.message
                : 'Failed to create free ticket. Please try again.',
            );
            setLoading(false);
            return;
          }
        }

        // Store event ID for cleanup
        setEventId(eventId);

        // Parse ticketIds from JSON
        let parsedTicketIds: (
          | string
          | { sectionId: string; seatId: string }
        )[] = [];
        try {
          console.log(
            '[Checkout] Raw ticketIds from search params:',
            ticketIds,
          );
          parsedTicketIds = JSON.parse(ticketIds);
          console.log('[Checkout] Parsed ticketIds:', parsedTicketIds);
        } catch {
          // Fallback: treat as comma-separated string
          console.log(
            '[Checkout] JSON.parse failed, treating as comma-separated',
          );
          parsedTicketIds = ticketIds.split(',');
        }

        // Store reserved seats for cleanup on unmount
        const seatedTickets = parsedTicketIds.filter(
          (t) => typeof t === 'object' && t.sectionId && t.seatId,
        );
        console.log('[Checkout] Filtered seatedTickets:', seatedTickets);
        if (seatedTickets.length > 0) {
          setReservedSeats(
            seatedTickets as { sectionId: string; seatId: string }[],
          );
        }

        // Create checkout session with backend
        console.log('[Checkout] Sending ticketIds to backend:', {
          parsedTicketIds,
          count: Array.isArray(parsedTicketIds) ? parsedTicketIds.length : 1,
          type: typeof parsedTicketIds,
          isArray: Array.isArray(parsedTicketIds),
          stringified: JSON.stringify(parsedTicketIds),
          items: Array.isArray(parsedTicketIds)
            ? parsedTicketIds.map((item: any, idx: number) => ({
                index: idx,
                type: typeof item,
                value: JSON.stringify(item),
                isObject: typeof item === 'object',
                hasSection: (item as any)?.sectionId ? 'yes' : 'no',
                hasSeat: (item as any)?.seatId ? 'yes' : 'no',
              }))
            : [],
        });
        const response = await paymentsAPI.createCheckoutSession({
          eventId,
          ticketIds: parsedTicketIds,
          totalAmount: parseFloat(totalAmount),
          buyerEmail,
          buyerName,
          buyerPhoneNumber,
          ticketType,
        });

        setCheckoutData({
          eventName: eventName || 'Event',
          totalAmount: parseFloat(totalAmount),
          ticketCount: Array.isArray(parsedTicketIds)
            ? parsedTicketIds.length
            : 1,
        });

        setClientSecret(response.data.data.clientSecret);
      } catch (err) {
        console.error('Checkout initialization error:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to initialize checkout. Please try again.',
        );
      } finally {
        setLoading(false);
        initializingRef.current = false; // Reset guard for potential retries
      }
    };

    initializeCheckout();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p>Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <h1 className="text-2xl font-bold text-red-700 mb-4">
            Checkout Error
          </h1>
          <p className="text-red-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  if (!clientSecret || !checkoutData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>Initializing payment...</p>
        </div>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-600 mt-2">
            Complete your payment to book your tickets
          </p>
        </div>

        <Elements options={options} stripe={stripePromise}>
          <CheckoutForm
            clientSecret={clientSecret}
            eventName={checkoutData.eventName}
            totalAmount={checkoutData.totalAmount}
            ticketCount={checkoutData.ticketCount}
            eventId={eventId || ''}
            reservedSeats={reservedSeats}
          />
        </Elements>
      </div>
    </div>
  );
}

// Main Checkout Page with Suspense
export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
            <p>Loading checkout...</p>
          </div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
