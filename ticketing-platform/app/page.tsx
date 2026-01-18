'use client';

import { useState, useEffect } from 'react';
import { eventsAPI } from '@/lib/api';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';

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

  // Get the pricing display text
  const getPricingText = () => {
    if (!event.ticketTypes) return null;

    // Check if Free ticket is available
    if (event.ticketTypes.Free?.enabled) {
      return 'Free';
    }

    // Get minimum price from enabled paid ticket types
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

          {/* Price Badge */}
          {pricingText && (
            <div className="absolute bottom-4 right-4 bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-lg">
              {pricingText}
            </div>
          )}

          {/* Event Title */}
          <div className="absolute bottom-4 left-4 right-4 pr-20">
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

        {/* Price Badge */}
        {pricingText && (
          <div className="absolute bottom-4 right-4 bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-lg">
            {pricingText}
          </div>
        )}

        {/* Event Title */}
        <div className="absolute bottom-4 left-4 right-4 pr-20">
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
          className={`w-full mt-6 py-3 rounded-xl font-semibold transition ${
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
  const { user, loading: authLoading, logout } = useAuth();

  // Filter out expired events (events where the date has passed)
  const upcomingEvents = events.filter((e) => {
    const eventDate = new Date(e.date);
    const now = new Date();
    // Consider an event expired if it's in the past
    return eventDate.getTime() > now.getTime();
  });

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await eventsAPI.getAll();
        setEvents(response.data);
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
      {/* Navigation */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <span className="text-white text-lg font-bold">G</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-stone-900 tracking-tight">
                  Golden Moment
                </h1>
                <p className="text-xs text-stone-500 -mt-0.5">
                  Events & Experiences
                </p>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link
                href="/"
                className="text-stone-900 font-medium hover:text-amber-600 transition"
              >
                Events
              </Link>
              <Link
                href="/about"
                className="text-stone-600 hover:text-amber-600 transition"
              >
                About
              </Link>
              <Link
                href="/contact"
                className="text-stone-600 hover:text-amber-600 transition"
              >
                Contact
              </Link>

{/* Auth Links */}
              {authLoading ? (
                <div className="w-20 h-8 bg-stone-200 animate-pulse rounded"></div>
              ) : user ? (
                <div className="flex items-center gap-4">
                  <Link
                    href="/"
                    className="text-stone-600 hover:text-amber-600 transition"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={logout}
                    className="bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition text-sm font-medium"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Link
                    href="/auth/login"
                    className="text-stone-600 hover:text-amber-600 transition"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition text-sm font-medium"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </nav>

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2 text-stone-600">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50"></div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 px-4 py-2 rounded-full text-sm font-medium mb-8 border border-amber-500/20">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
              Premium Event Experiences in Tunisia
            </div>

            <h2 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
              Create Memories That Last a{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-500">
                Lifetime
              </span>
            </h2>

            <p className="text-xl text-stone-300 mb-10 leading-relaxed max-w-2xl">
              Discover and book exclusive tickets to the most extraordinary
              events. From concerts to conferences, your next unforgettable
              experience awaits.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#events"
                className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-amber-600 hover:to-amber-700 transition shadow-xl shadow-amber-500/25 text-center"
              >
                Explore Events
              </a>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl"></div>
      </section>

      {/* Stats Bar */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-stone-900">500+</p>
              <p className="text-stone-600 text-sm mt-1">Events Hosted</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-stone-900">50K+</p>
              <p className="text-stone-600 text-sm mt-1">Happy Customers</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-stone-900">99%</p>
              <p className="text-stone-600 text-sm mt-1">Satisfaction Rate</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-stone-900">24/7</p>
              <p className="text-stone-600 text-sm mt-1">Support Available</p>
            </div>
          </div>
        </div>
      </section>

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
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-stone-900 text-white rounded-lg font-medium text-sm">
              All Events
            </button>
            <button className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg font-medium text-sm hover:bg-stone-200 transition">
              This Week
            </button>
            <button className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg font-medium text-sm hover:bg-stone-200 transition">
              This Month
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin"></div>
            <p className="text-stone-600 mt-4">Loading events...</p>
          </div>
        ) : upcomingEvents.length === 0 ? (
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
              No events available
            </p>
            <p className="text-stone-500 mt-2">
              Check back soon for exciting upcoming events!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {upcomingEvents.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
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
                      events.filter((x) => x.category).length === 0)
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

      {/* Q&A Section */}
      <section className="bg-white border-y border-stone-200 mt-20">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900">
              Frequently Asked Questions
            </h2>
            <p className="text-stone-600 mt-3 text-lg">
              Everything you need to know about booking events
            </p>
          </div>

          <div className="space-y-6">
            {/* FAQ Item 1 */}
            <details className="group border border-stone-200 rounded-lg overflow-hidden hover:border-amber-300 transition">
              <summary className="flex cursor-pointer items-center justify-between p-6 bg-stone-50 group-open:bg-amber-50 transition">
                <span className="text-lg font-semibold text-stone-900">
                  How do I book tickets?
                </span>
                <svg
                  className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </summary>
              <div className="px-6 py-4 text-stone-600">
                <p>
                  Browse through our event listings, select your preferred
                  event, choose your seats, and complete the checkout process.
                  You&apos;ll receive your e-ticket instantly via email.
                </p>
              </div>
            </details>

            {/* FAQ Item 2 */}
            <details className="group border border-stone-200 rounded-lg overflow-hidden hover:border-amber-300 transition">
              <summary className="flex cursor-pointer items-center justify-between p-6 bg-stone-50 group-open:bg-amber-50 transition">
                <span className="text-lg font-semibold text-stone-900">
                  Can I cancel or refund my tickets?
                </span>
                <svg
                  className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </summary>
              <div className="px-6 py-4 text-stone-600">
                <p>
                  Refund policies vary by event. Most events allow cancellations
                  up to 48 hours before the event. Check your booking
                  confirmation for specific terms.
                </p>
              </div>
            </details>

            {/* FAQ Item 3 */}
            <details className="group border border-stone-200 rounded-lg overflow-hidden hover:border-amber-300 transition">
              <summary className="flex cursor-pointer items-center justify-between p-6 bg-stone-50 group-open:bg-amber-50 transition">
                <span className="text-lg font-semibold text-stone-900">
                  What payment methods do you accept?
                </span>
                <svg
                  className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </summary>
              <div className="px-6 py-4 text-stone-600">
                <p>
                  We accept all major credit cards (Visa, Mastercard), digital
                  wallets, and local payment methods. Your payment is secure and
                  encrypted.
                </p>
              </div>
            </details>

            {/* FAQ Item 4 */}
            <details className="group border border-stone-200 rounded-lg overflow-hidden hover:border-amber-300 transition">
              <summary className="flex cursor-pointer items-center justify-between p-6 bg-stone-50 group-open:bg-amber-50 transition">
                <span className="text-lg font-semibold text-stone-900">
                  Do I need to print my ticket?
                </span>
                <svg
                  className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </summary>
              <div className="px-6 py-4 text-stone-600">
                <p>
                  No, our digital tickets can be shown directly on your mobile
                  device at the entrance. Printing is optional if you prefer a
                  physical copy.
                </p>
              </div>
            </details>

            {/* FAQ Item 5 */}
            <details className="group border border-stone-200 rounded-lg overflow-hidden hover:border-amber-300 transition">
              <summary className="flex cursor-pointer items-center justify-between p-6 bg-stone-50 group-open:bg-amber-50 transition">
                <span className="text-lg font-semibold text-stone-900">
                  What if I have accessibility needs?
                </span>
                <svg
                  className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </summary>
              <div className="px-6 py-4 text-stone-600">
                <p>
                  We offer accessible seating for events. Contact our support
                  team at support@goldenmoment.tn to discuss your specific
                  accessibility requirements.
                </p>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-900 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg font-bold">G</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Golden Moment</h3>
                  <p className="text-xs text-stone-400">Events & Experiences</p>
                </div>
              </div>
              <p className="text-stone-400 max-w-md">
                Your premier destination for booking tickets to the most
                exclusive events in Tunisia. Creating unforgettable moments, one
                ticket at a time.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-lg mb-4">Quick Links</h4>
              <ul className="space-y-3 text-stone-400">
                <li>
                  <Link href="/" className="hover:text-amber-400 transition">
                    Events
                  </Link>
                </li>
                <li>
                  <Link
                    href="/about"
                    className="hover:text-amber-400 transition"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="hover:text-amber-400 transition"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-lg mb-4">Contact</h4>
              <ul className="space-y-3 text-stone-400">
                <li>support@goldenmoment.tn</li>
                <li>+216 71 000 000</li>
                <li>Tunis, Tunisia</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-stone-800 mt-12 pt-8 text-center text-stone-500 text-sm">
            <p>© 2026 Golden Moment Events. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
