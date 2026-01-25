'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { paymentsAPI, ticketsAPI } from '@/lib/api';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const [payment, setPayment] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch payment details with optional forceRefresh to get latest paidAt
  const fetchPayment = async (forceRefresh = false) => {
    try {
      const paymentId = searchParams.get('paymentId');
      if (!paymentId) {
        setError('No payment ID found');
        return null;
      }

      const response = await paymentsAPI.getPayment(paymentId);
      const paymentData = response.data.data;
      setPayment(paymentData);

      if (forceRefresh) {
        setLoading(false); // Update loading state only on refresh
      }

      return paymentData;
    } catch (err) {
      console.error('Error fetching payment:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch payment details',
      );
      return null;
    }
  };

  // Initial payment fetch
  useEffect(() => {
    fetchPayment().then((paymentData) => {
      if (paymentData) {
        setLoading(false);
      }
    });
  }, [searchParams]);

  // Poll for tickets until they are created by webhook
  useEffect(() => {
    if (!payment?._id) return;

    let pollCount = 0;
    const maxPolls = 20; // Max 20 seconds of polling
    let timeoutId: NodeJS.Timeout;

    const pollTickets = async () => {
      try {
        const response = await ticketsAPI.getByPaymentId(payment._id);
        const fetchedTickets = response.data.data || response.data;

        if (Array.isArray(fetchedTickets) && fetchedTickets.length > 0) {
          setTickets(fetchedTickets);
          setTicketsLoading(false);

          // Refetch payment to ensure paidAt is populated from webhook update
          // This eliminates the "N/A" date issue after payment succeeds
          await fetchPayment(true);
        } else {
          pollCount++;
          // Tickets not yet created, retry in 1 second
          if (pollCount < maxPolls) {
            timeoutId = setTimeout(pollTickets, 1000);
          } else {
            // Stop polling after timeout, but show partial data
            setTicketsLoading(false);
          }
        }
      } catch (err) {
        console.error('Error fetching tickets:', err);
        pollCount++;
        // Retry on error
        if (pollCount < maxPolls) {
          timeoutId = setTimeout(pollTickets, 1000);
        } else {
          setTicketsLoading(false);
        }
      }
    };

    // Start polling after a small delay to allow webhook to process
    timeoutId = setTimeout(pollTickets, 500);
    return () => clearTimeout(timeoutId);
  }, [payment?._id]);

  if (loading || ticketsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-stone-50 to-amber-50/30">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-200 border-t-amber-600 mx-auto"></div>
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">
            Processing Payment
          </h2>
          <p className="text-stone-600 mb-4">
            {ticketsLoading
              ? 'Creating your tickets...'
              : 'Loading payment confirmation...'}
          </p>
          <p className="text-sm text-stone-500">
            This may take a few moments. Please don't close this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-50 to-amber-50/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl border border-stone-200/50 overflow-hidden">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-8 text-center">
            <div className="mb-4">
              <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Payment Successful!
            </h1>
            <p className="text-amber-50">
              Your tickets have been created and confirmation has been sent to
              your email.
            </p>
          </div>

          {/* Payment Details */}
          {payment && (
            <div className="p-8 border-b border-stone-200">
              <h2 className="text-lg font-bold text-stone-900 mb-6">
                Payment Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-stone-50 rounded-lg p-4">
                  <p className="text-stone-600 text-sm font-semibold uppercase mb-1">
                    Amount Paid
                  </p>
                  <p className="text-3xl font-bold text-amber-600">
                    ${(payment.amount / 100).toFixed(2)}
                  </p>
                </div>
                <div className="bg-stone-50 rounded-lg p-4">
                  <p className="text-stone-600 text-sm font-semibold uppercase mb-1">
                    Payment ID
                  </p>
                  <p className="text-sm font-mono text-stone-900 break-all">
                    {payment._id}
                  </p>
                </div>
                <div className="bg-stone-50 rounded-lg p-4">
                  <p className="text-stone-600 text-sm font-semibold uppercase mb-1">
                    Status
                  </p>
                  <p className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {payment.status === 'succeeded'
                      ? '✓ Confirmed'
                      : 'Processing'}
                  </p>
                </div>
                <div className="bg-stone-50 rounded-lg p-4">
                  <p className="text-stone-600 text-sm font-semibold uppercase mb-1">
                    Date
                  </p>
                  <p className="text-sm text-stone-900">
                    {payment.paidAt
                      ? new Date(payment.paidAt).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
                {payment.metadata?.buyerEmail && (
                  <div className="bg-stone-50 rounded-lg p-4 md:col-span-2">
                    <p className="text-stone-600 text-sm font-semibold uppercase mb-1">
                      Confirmation Email
                    </p>
                    <p className="text-sm text-stone-900">
                      {payment.metadata.buyerEmail}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tickets Created */}
          {tickets.length > 0 && (
            <div className="p-8 border-b border-stone-200">
              <h2 className="text-lg font-bold text-stone-900 mb-4">
                Tickets Created ({tickets.length})
              </h2>
              <div className="space-y-3">
                {tickets.map((ticket, idx) => (
                  <div
                    key={ticket._id}
                    className="bg-amber-50 border border-amber-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-stone-900">
                          Ticket {idx + 1}
                        </p>
                        <p className="text-sm text-stone-600">
                          ID: {ticket.ticketNumber}
                        </p>
                      </div>
                      <Link
                        href={`/receipt/${ticket._id}`}
                        className="text-amber-600 hover:text-amber-700 font-semibold text-sm"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-8 bg-red-50 border-b border-red-200">
              <p className="text-red-700 font-semibold mb-2">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-8 bg-stone-50 space-y-3">
            {tickets.length > 0 && (
              <Link
                href={`/receipt/${tickets[0]._id}`}
                className="block w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg transition text-center"
              >
                View Receipt
              </Link>
            )}
            <Link
              href="/"
              className="block w-full bg-stone-200 hover:bg-stone-300 text-stone-900 font-bold py-3 px-4 rounded-lg transition text-center"
            >
              Back to Home
            </Link>
          </div>

          {/* Additional Info */}
          <div className="px-8 py-6 border-t border-stone-200 bg-white">
            <p className="text-sm text-stone-600 mb-2">
              ✓ A confirmation email with your tickets has been sent. Please
              check your inbox and spam folder.
            </p>
            <p className="text-sm text-stone-600">
              Need help?{' '}
              <span className="font-semibold">
                Contact support@goldenmoment.tn
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
