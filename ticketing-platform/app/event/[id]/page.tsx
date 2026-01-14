'use client';

import { useState, useEffect } from 'react';
import { eventsAPI, ticketsAPI, seatsAPI } from '@/lib/api';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import SeatMap from '@/components/SeatMap';

interface Event {
  _id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  totalSeats: number;
  soldTickets: number;
  ticketPrice?: number;
  seatingLayout?: {
    enabled: boolean;
    sections: any[];
  };
}

interface Ticket {
  _id: string;
  ticketNumber: string;
}

interface SelectedSeat {
  sectionId: string;
  seatId: string;
  price: number;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);

  const [formData, setFormData] = useState({
    buyerName: '',
    buyerEmail: '',
  });

  // Selected seats are tracked locally only - NOT synced to backend until payment
  // This removes the live reservation system

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await eventsAPI.getById(eventId);
        setEvent(response.data);
      } catch (err) {
        setError('Failed to load event details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEvent();
    }

    // NO CLEANUP: Seats are only locked at payment time, not during selection
    // Users can navigate away without unreserving - seats remain available for others
  }, [eventId]);

  const handleBuyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    try {
      setSubmitting(true);
      setError(null);

      // If visual seating is enabled, atomically finalize the selected seats at purchase time
      if (event.seatingLayout?.enabled && selectedSeats.length > 0) {
        console.log(
          '[EventDetail] Finalizing purchase for seats:',
          selectedSeats.map((s) => s.seatId)
        );

        // Call the atomic finalizePurchase endpoint
        // This will lock seats and prevent double-booking
        const purchaseData = {
          eventId: event._id,
          seats: selectedSeats.map((seat) => ({
            sectionId: seat.sectionId,
            seatId: seat.seatId,
          })),
          buyerName: formData.buyerName,
          buyerEmail: formData.buyerEmail,
        };

        const response = await seatsAPI.finalizePurchase(purchaseData);
        const ticket: Ticket = response.data;

        console.log('[EventDetail] Purchase finalized successfully:', ticket._id);
        router.push(`/receipt/${ticket._id}`);
      } else {
        // No visual seating or no seats selected - auto-assign seats
        const ticketData = {
          eventId: event._id,
          seats: [],
          buyerName: formData.buyerName,
          buyerEmail: formData.buyerEmail,
        };

        const response = await ticketsAPI.create(ticketData);
        const ticket: Ticket = response.data;

        router.push(`/receipt/${ticket._id}`);
      }
    } catch (err: any) {
      // Handle race condition - seat was just purchased by another user
      if (err.response?.status === 409 || err.response?.data?.message?.includes('just sold')) {
        setError(
          'One or more seats were just purchased by another user. Please select different seats and try again.'
        );
        // Reload the seat map to show current availability
        window.location.reload();
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.message || 'Invalid seat selection. Please try again.');
      } else {
        setError('Failed to purchase ticket. Please try again.');
      }
      console.error('[EventDetail] Purchase failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-stone-600 mt-4">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-stone-50">
        <header className="bg-white border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <Link
              href="/"
              className="text-amber-600 hover:text-amber-700 font-medium flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Events
            </Link>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-stone-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-xl font-semibold text-stone-900">
            Event not found
          </p>
          <p className="text-stone-500 mt-2">
            The event you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </p>
        </div>
      </div>
    );
  }

  const ticketsAvailable = event.totalSeats - event.soldTickets;
  const soldPercentage = (event.soldTickets / event.totalSeats) * 100;
  const eventDate = new Date(event.date);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="text-stone-600 hover:text-stone-900 font-medium flex items-center gap-2 transition"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Events
            </Link>

            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">G</span>
              </div>
              <span className="font-bold text-stone-900">Golden Moment</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-sm font-medium mb-4">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {eventDate.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                {event.name}
              </h1>
              <p className="text-xl text-stone-300 max-w-2xl">
                {event.description}
              </p>
            </div>

            {/* Date Card */}
            <div className="bg-white text-stone-900 rounded-2xl p-6 text-center shadow-xl min-w-[140px]">
              <p className="text-sm font-bold text-amber-600 uppercase">
                {eventDate.toLocaleString('en-US', { month: 'short' })}
              </p>
              <p className="text-5xl font-bold -mt-1">{eventDate.getDate()}</p>
              <p className="text-stone-500 text-sm">
                {eventDate.toLocaleString('en-US', { weekday: 'long' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Event Info Bar */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-stone-500">Venue</p>
                <p className="font-semibold text-stone-900">{event.venue}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-stone-500">Ticket Price</p>
                <p className="font-semibold text-stone-900">
                  {event.ticketPrice
                    ? `$${event.ticketPrice.toFixed(2)}`
                    : 'TBD'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-stone-500">Time</p>
                <p className="font-semibold text-stone-900">
                  {eventDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-stone-500">Capacity</p>
                <p className="font-semibold text-stone-900">
                  {event.totalSeats} Seats
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-8 flex items-center gap-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Booking Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-stone-200 p-8">
              <h2 className="text-2xl font-bold text-stone-900 mb-2">
                Book Your Ticket
              </h2>
              <p className="text-stone-600 mb-8">
                Fill in your details to secure your spot
              </p>

              {ticketsAvailable === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-xl">
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-stone-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  </div>
                  <p className="text-xl font-semibold text-stone-900 mb-2">
                    This event is sold out
                  </p>
                  <p className="text-stone-500 mb-6">
                    All tickets have been purchased
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium"
                  >
                    Explore other events
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              ) : (
                <>
                  {/* Visual Seat Selection */}
                  {event.seatingLayout?.enabled ? (
                    <div className="space-y-6">
                      <SeatMap
                        eventId={eventId}
                        onSeatsSelected={(seats, total) => {
                          setSelectedSeats(seats);
                          setTotalPrice(total);
                        }}
                      />

                      {selectedSeats.length > 0 && (
                        <div className="border-t border-stone-200 pt-6">
                          <h3 className="text-lg font-bold text-stone-900 mb-4">
                            Complete Your Booking
                          </h3>
                          <form
                            onSubmit={handleBuyTicket}
                            className="space-y-6"
                          >
                            <div>
                              <label className="block text-sm font-semibold text-stone-700 mb-2">
                                Full Name
                              </label>
                              <input
                                type="text"
                                placeholder="Your full name"
                                value={formData.buyerName}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    buyerName: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-stone-700 mb-2">
                                Email Address
                              </label>
                              <input
                                type="email"
                                placeholder="your@email.com"
                                value={formData.buyerEmail}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    buyerEmail: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                                required
                              />
                              <p className="text-xs text-stone-500 mt-2">
                                Your e-ticket will be sent to this address
                              </p>
                            </div>

                            <button
                              type="submit"
                              disabled={submitting}
                              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white py-4 rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {submitting ? (
                                <>
                                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="w-5 h-5"
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
                                  Complete Purchase (${totalPrice.toFixed(2)})
                                </>
                              )}
                            </button>

                            <p className="text-xs text-stone-500 text-center">
                              Your tickets will be instantly generated with
                              unique QR codes
                            </p>
                          </form>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Automatic Seat Assignment - No visual seating */
                    <form onSubmit={handleBuyTicket} className="space-y-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                          <svg
                            className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <div>
                            <p className="text-sm font-semibold text-blue-900">
                              Automatic Seat Assignment
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                              Your seat will be automatically assigned when you
                              complete your purchase
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          placeholder="Your full name"
                          value={formData.buyerName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              buyerName: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          placeholder="your@email.com"
                          value={formData.buyerEmail}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              buyerEmail: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                          required
                        />
                        <p className="text-xs text-stone-500 mt-2">
                          Your e-ticket will be sent to this address
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white py-4 rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-5 h-5"
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
                            Complete Purchase ($
                            {event.ticketPrice?.toFixed(2) || '0.00'})
                          </>
                        )}
                      </button>

                      <p className="text-xs text-stone-500 text-center">
                        Your ticket will be instantly generated with a unique QR
                        code
                      </p>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="bg-white rounded-2xl border border-stone-200 p-6 sticky top-24">
              <h3 className="text-lg font-bold text-stone-900 mb-6">
                Availability
              </h3>

              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-stone-500">Tickets Sold</span>
                  <span className="font-semibold text-stone-900">
                    {event.soldTickets}/{event.totalSeats}
                  </span>
                </div>
                <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      soldPercentage < 50
                        ? 'bg-green-500'
                        : soldPercentage < 80
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${soldPercentage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  {soldPercentage.toFixed(0)}% sold
                </p>
              </div>

              <div
                className={`p-4 rounded-xl text-center font-bold ${
                  ticketsAvailable === 0
                    ? 'bg-stone-100 text-stone-500'
                    : ticketsAvailable < 20
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-green-50 text-green-600 border border-green-200'
                }`}
              >
                {ticketsAvailable === 0
                  ? 'SOLD OUT'
                  : `${event.soldTickets}/${event.totalSeats} Sold`}
              </div>

              <div className="mt-8 space-y-4">
                <h4 className="text-sm font-semibold text-stone-700">
                  What you&apos;ll get:
                </h4>

                <div className="flex items-start gap-3 text-sm text-stone-600">
                  <svg
                    className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Instant email confirmation</span>
                </div>

                <div className="flex items-start gap-3 text-sm text-stone-600">
                  <svg
                    className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Digital e-ticket with QR code</span>
                </div>

                <div className="flex items-start gap-3 text-sm text-stone-600">
                  <svg
                    className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Download as PDF</span>
                </div>

                <div className="flex items-start gap-3 text-sm text-stone-600">
                  <svg
                    className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Secure transaction</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-stone-900 text-white mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center">
          <p className="text-stone-400 text-sm">
            © 2026 Golden Moment Events. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
