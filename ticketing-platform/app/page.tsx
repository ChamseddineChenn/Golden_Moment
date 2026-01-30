'use client';

import { useState, useEffect } from 'react';
import { eventsAPI } from '@/lib/api';
import { applyFilters, getAvailableTicketTypes } from '@/lib/eventFilters';
import { EventFilters, FilterState } from '@/components/EventFilters';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Hero } from '@/components/layout/Hero';
import { StatsBar } from '@/components/layout/StatsBar';
import { Footer } from '@/components/layout/Footer';
import { FAQ } from '@/components/layout/FAQ';

interface Event {
  _id: string;
  name: string;
  description: string;
  coverImage?: string;
  date: string;
  venue: string;
  totalSeats: number;
  soldTickets: number;
  ticketPrice?: number;
  category?: string;
  ticketTypes?: {
    Free: { enabled: boolean; price?: number };
    Standard: { enabled: boolean; price?: number };
    EarlyBird: { enabled: boolean; price?: number; limit?: number };
    VIP: { enabled: boolean; price?: number };
  };
}

function EventCard({ event }: { event: Event }) {
  const totalSeats = event.totalSeats || 0;
  const ticketsAvailable = totalSeats - event.soldTickets;
  const soldPercentage =
    totalSeats > 0 ? (event.soldTickets / totalSeats) * 100 : 0;
  const eventDate = new Date(event.date);
  const isAlmostSoldOut = soldPercentage >= 80;
  const isExpired = eventDate < new Date();
  const isSoldOut = ticketsAvailable <= 0 && totalSeats > 0;
  const getTicketTypesWithPrices = () => {
    if (!event.ticketTypes) return [];

    const types: Array<{
      name: string;
      price: number | string;
      enabled: boolean;
    }> = [];

    if (event.ticketTypes.Free?.enabled) {
      types.push({ name: 'Free', price: 'Free', enabled: true });
    }
    if (event.ticketTypes.EarlyBird?.enabled) {
      types.push({
        name: 'EarlyBird',
        price: event.ticketTypes.EarlyBird.price ?? 0,
        enabled: true,
      });
    }
    if (event.ticketTypes.Standard?.enabled) {
      types.push({
        name: 'Standard',
        price: event.ticketTypes.Standard.price ?? 0,
        enabled: true,
      });
    }
    if (event.ticketTypes.VIP?.enabled) {
      types.push({
        name: 'VIP',
        price: event.ticketTypes.VIP.price ?? 0,
        enabled: true,
      });
    }

    return types.sort((a, b) => {
      const aPrice = typeof a.price === 'string' ? 0 : a.price;
      const bPrice = typeof b.price === 'string' ? 0 : b.price;
      return aPrice - bPrice;
    });
  };

  const allTicketTypes = getTicketTypesWithPrices();

  const getPricingText = () => {
    if (!event.ticketTypes) return null;
    if (event.ticketTypes.Free?.enabled) {
      return 'Free';
    }
    const enabledPaidTypes = [
      event.ticketTypes.Standard,
      event.ticketTypes.EarlyBird,
      event.ticketTypes.VIP,
    ].filter((type) => type?.enabled && type?.price !== undefined);

    if (enabledPaidTypes.length === 0) return null;

    const minPrice = Math.min(...enabledPaidTypes.map((t) => t!.price || 0));
    return minPrice === 0 ? 'Free' : `Starting from $${minPrice.toFixed(2)}`;
  };

  const pricingText = getPricingText();

  if (isExpired) {
    return (
      <div className="group bg-white rounded-2xl overflow-hidden border border-stone-200 opacity-60 cursor-not-allowed">
        {/* Event Image */}
        <div className="relative h-48 bg-gradient-to-br from-stone-800 to-stone-900 overflow-hidden">
          {event.coverImage && (
            <img
              src={event.coverImage}
              alt={event.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute top-4 left-4 bg-white rounded-xl p-3 text-center shadow-lg">
            <p className="text-xs font-bold text-amber-600 uppercase">
              {eventDate.toLocaleString('en-US', { month: 'short' })}
            </p>
            <p className="text-2xl font-bold text-stone-900 -mt-1">
              {eventDate.getDate()}
            </p>
          </div>

          <div className="absolute top-4 right-4 bg-stone-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            Expired
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-stone-900 mb-2">
            {event.name}
          </h3>
          <p className="text-sm text-stone-600 mb-4 line-clamp-2">
            {event.description}
          </p>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm text-stone-700">
              <svg
                className="w-4 h-4 text-amber-500"
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
              <span className="truncate">{event.venue}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-stone-700">
              <svg
                className="w-4 h-4 text-amber-500"
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
              <span>
                {eventDate.toLocaleString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          {/* Pricing Info */}
          <div className="pt-4 border-t border-stone-100">
            <p className="text-sm text-stone-500">
              {pricingText ? `${pricingText}` : 'Price TBA'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If sold out, render as div instead of Link to prevent navigation
  if (isSoldOut) {
    return (
      <div className="group bg-white rounded-2xl overflow-hidden border border-stone-200 opacity-60 cursor-not-allowed">
        {/* Event Image */}
        <div className="relative h-48 bg-gradient-to-br from-stone-800 to-stone-900 overflow-hidden">
          {event.coverImage && (
            <img
              src={event.coverImage}
              alt={event.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

          {/* Date Badge */}
          <div className="absolute top-4 left-4 bg-white rounded-xl p-3 text-center shadow-lg">
            <p className="text-xs font-bold text-amber-600 uppercase">
              {eventDate.toLocaleString('en-US', { month: 'short' })}
            </p>
            <p className="text-2xl font-bold text-stone-900 -mt-1">
              {eventDate.getDate()}
            </p>
          </div>

          {/* Status Badge */}
          {isExpired && (
            <div className="absolute top-4 right-4 bg-stone-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              Expired
            </div>
          )}
          {!isExpired && isAlmostSoldOut && ticketsAvailable > 0 && (
            <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              Almost Sold Out
            </div>
          )}
          {!isExpired && ticketsAvailable === 0 && (
            <div className="absolute top-4 right-4 bg-stone-800 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              Sold Out
            </div>
          )}

          {/* Price Badge - Main Price with All Options - Top Right Below Status */}
          {pricingText && (
            <div className="absolute top-4 right-4 flex flex-col items-end gap-1 z-10">
              <div className="bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-lg">
                {pricingText}
              </div>
              {allTicketTypes.length > 1 && (
                <div className="text-xs text-white font-medium space-y-0.5">
                  {allTicketTypes.slice(1).map((type) => (
                    <div key={type.name} className="text-right opacity-90">
                      {type.name}:{' '}
                      {typeof type.price === 'string'
                        ? type.price
                        : `$${type.price.toFixed(2)}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Event Title */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition">
              {event.name}
            </h3>
          </div>
        </div>

        {/* Event Details */}
        <div className="p-6">
          <p className="text-stone-600 text-sm line-clamp-2 mb-4">
            {event.description}
          </p>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm text-stone-700">
              <svg
                className="w-4 h-4 text-amber-500"
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
              <span className="truncate">{event.venue}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-stone-700">
              <svg
                className="w-4 h-4 text-amber-500"
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
              <span>
                {eventDate.toLocaleString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          {/* Availability */}
          <div className="pt-4 border-t border-stone-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-stone-500">Availability</span>
              <span className="text-sm font-semibold text-stone-400">
                {Math.max(0, ticketsAvailable)}/{totalSeats}
              </span>
            </div>
            <div className="w-full bg-stone-200 rounded-full h-2">
              <div
                className="bg-stone-400 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, soldPercentage)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal clickable card for available events
  return (
    <Link
      href={`/event/${event._id}`}
      className="group bg-white rounded-2xl overflow-hidden border border-stone-200 hover:border-amber-300 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300"
    >
      {/* Event Image */}
      <div className="relative h-48 bg-gradient-to-br from-stone-800 to-stone-900 overflow-hidden">
        {event.coverImage && (
          <img
            src={event.coverImage}
            alt={event.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

        {/* Date Badge */}
        <div className="absolute top-4 left-4 bg-white rounded-xl p-3 text-center shadow-lg">
          <p className="text-xs font-bold text-amber-600 uppercase">
            {eventDate.toLocaleString('en-US', { month: 'short' })}
          </p>
          <p className="text-2xl font-bold text-stone-900 -mt-1">
            {eventDate.getDate()}
          </p>
        </div>

        {/* Status Badge */}
        {isExpired && (
          <div className="absolute top-4 right-4 bg-stone-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            Expired
          </div>
        )}
        {!isExpired && isAlmostSoldOut && ticketsAvailable > 0 && (
          <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            Almost Sold Out
          </div>
        )}
        {!isExpired && ticketsAvailable === 0 && (
          <div className="absolute top-4 right-4 bg-stone-800 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            Sold Out
          </div>
        )}

        {/* Price Badge - Main Price with All Options */}
        {pricingText && (
          <div className="absolute top-4 right-4 flex flex-col items-end gap-1 z-10">
            <div className="bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-lg">
              {pricingText}
            </div>
            {allTicketTypes.length > 1 && (
              <div className="text-xs text-white font-medium space-y-0.5">
                {allTicketTypes.slice(1).map((type) => (
                  <div key={type.name} className="text-right opacity-90">
                    {type.name}:{' '}
                    {typeof type.price === 'string'
                      ? type.price
                      : `$${type.price.toFixed(2)}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Event Title */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition">
            {event.name}
          </h3>
        </div>
      </div>

      {/* Event Details */}
      <div className="p-6">
        <p className="text-stone-600 text-sm line-clamp-2 mb-4">
          {event.description}
        </p>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-sm text-stone-700">
            <svg
              className="w-4 h-4 text-amber-500"
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
            <span className="truncate">{event.venue}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-stone-700">
            <svg
              className="w-4 h-4 text-amber-500"
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
            <span>
              {eventDate.toLocaleString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Availability */}
        <div className="pt-4 border-t border-stone-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-stone-500">Availability</span>
            <span
              className={`text-sm font-semibold ${
                isExpired
                  ? 'text-stone-400'
                  : ticketsAvailable === 0
                    ? 'text-stone-400'
                    : ticketsAvailable < 20
                      ? 'text-red-600'
                      : 'text-green-600'
              }`}
            >
              {ticketsAvailable} / {event.totalSeats} seats
            </span>
          </div>
          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                soldPercentage < 50
                  ? 'bg-green-500'
                  : soldPercentage < 80
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${soldPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* CTA */}
        <button
          className={`w-full mt-6 py-3 rounded-xl font-semibold transition cursor-pointer ${
            isExpired || ticketsAvailable === 0
              ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/20'
          }`}
          disabled={isExpired || ticketsAvailable === 0}
        >
          {isExpired
            ? 'Event Expired'
            : ticketsAvailable === 0
              ? 'Sold Out'
              : 'Get Tickets →'}
        </button>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedDate: '',
    selectedTicketTypes: [],
    priceFilterType: 'all',
    minPrice: '',
    maxPrice: '',
  });

  // Filter out expired events (events where the date has passed)
  const upcomingEvents = events.filter((e) => {
    const eventDate = new Date(e.date);
    const now = new Date();
    return eventDate.getTime() > now.getTime();
  });

  // Apply filters to upcoming events
  const filteredUpcomingEvents = applyFilters(upcomingEvents, filters);
  const availableTicketTypes = getAvailableTicketTypes(upcomingEvents);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await eventsAPI.getAll();
        // Extract data from standardized response format { success, statusCode, data, timestamp }
        const eventsData = response.data.data || response.data;
        setEvents(Array.isArray(eventsData) ? eventsData : []);
      } catch (err) {
        setError('Failed to load events');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Fetch on mount
    fetchEvents();

    // Auto-refresh every 5 seconds to show updated sold ticket counts
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <Hero />
      <StatsBar />

      {/* Events Section */}
      <section id="events" className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900">
              Upcoming Events
            </h2>
            <p className="text-stone-600 mt-2 text-lg">
              Discover extraordinary experiences waiting for you
            </p>
          </div>
        </div>

        {/* Event Filters */}
        <EventFilters
          onFilterChange={setFilters}
          ticketTypesAvailable={availableTicketTypes}
        />

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin"></div>
            <p className="text-stone-600 mt-4">Loading events...</p>
          </div>
        ) : filteredUpcomingEvents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-xl font-semibold text-stone-900">
              {upcomingEvents.length === 0
                ? 'No events available'
                : 'No events match your filters'}
            </p>
            <p className="text-stone-500 mt-2">
              {upcomingEvents.length === 0
                ? 'Check back soon for exciting upcoming events!'
                : 'Try adjusting your filters to see more events.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-stone-600">
              Showing {filteredUpcomingEvents.length} of {upcomingEvents.length}{' '}
              events
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredUpcomingEvents.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Categories Section */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="space-y-16">
          {/* Movies */}
          <div>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-stone-900">
                  🎬 Movies
                </h2>
                <p className="text-stone-600 mt-2">
                  Experience cinema at its finest
                </p>
              </div>
              <Link
                href="/category/Movies"
                className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-lg font-medium transition"
              >
                See More →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {events
                .filter(
                  (e) =>
                    e.category === 'Movies' ||
                    (e.category === undefined &&
                      events.filter((x) => x.category).length === 0),
                )
                .slice(0, 3)
                .map((event) => (
                  <EventCard key={event._id} event={event} />
                ))}
            </div>
          </div>

          {/* Theatre */}
          <div>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-stone-900">
                  🎭 Theatre
                </h2>
                <p className="text-stone-600 mt-2">
                  Dramatic performances & stage shows
                </p>
              </div>
              <Link
                href="/category/Theatre"
                className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-lg font-medium transition"
              >
                See More →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {events
                .filter((e) => e.category === 'Theatre')
                .slice(0, 3)
                .map((event) => (
                  <EventCard key={event._id} event={event} />
                ))}
            </div>
          </div>

          {/* Concert */}
          <div>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-stone-900">
                  🎵 Concert
                </h2>
                <p className="text-stone-600 mt-2">
                  Live music events & performances
                </p>
              </div>
              <Link
                href="/category/Concert"
                className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-lg font-medium transition"
              >
                See More →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {events
                .filter((e) => e.category === 'Concert')
                .slice(0, 3)
                .map((event) => (
                  <EventCard key={event._id} event={event} />
                ))}
            </div>
          </div>

          {/* Sahra */}
          <div>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-stone-900">
                  🌙 Sahra
                </h2>
                <p className="text-stone-600 mt-2">
                  Desert nights & traditional experiences
                </p>
              </div>
              <Link
                href="/category/Sahra"
                className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-lg font-medium transition"
              >
                See More →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {events
                .filter((e) => e.category === 'Sahra')
                .slice(0, 3)
                .map((event) => (
                  <EventCard key={event._id} event={event} />
                ))}
            </div>
          </div>
        </div>
      </section>
      <FAQ />
      <Footer />
    </div>
  );
}
