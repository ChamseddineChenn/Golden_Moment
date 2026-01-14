'use client';

import { useState, useEffect } from 'react';
import { eventsAPI } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Event {
  _id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  totalSeats: number;
  soldTickets: number;
  ticketPrice?: number;
  category?: string;
}

function EventCard({ event }: { event: Event }) {
  const ticketsAvailable = event.totalSeats - event.soldTickets;
  const soldPercentage = (event.soldTickets / event.totalSeats) * 100;
  const eventDate = new Date(event.date);
  const isAlmostSoldOut = soldPercentage >= 80;
  const isExpired = eventDate < new Date();

  return (
    <Link
      href={`/event/${event._id}`}
      className="group bg-white rounded-2xl overflow-hidden border border-stone-200 hover:border-amber-300 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300"
    >
      {/* Event Image Placeholder */}
      <div className="relative h-48 bg-gradient-to-br from-stone-800 to-stone-900 overflow-hidden">
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
        {event.ticketPrice && (
          <div className="absolute bottom-4 right-4 bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-lg">
            ${event.ticketPrice.toFixed(2)}
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

const categoryIcons: { [key: string]: string } = {
  Movies: '🎬',
  Theatre: '🎭',
  Concert: '🎵',
  Sahra: '🌙',
};

export default function CategoryPage() {
  const params = useParams();
  const category = params.category as string;
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter out expired events
  const upcomingEvents = events.filter((e) => {
    const eventDate = new Date(e.date);
    return eventDate > new Date();
  });

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await eventsAPI.getAll();
        const filtered = response.data.filter(
          (event: Event) => event.category === category
        );
        setEvents(filtered);
      } catch (err) {
        setError('Failed to load events');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [category]);

  const displayCategory = decodeURIComponent(category);
  const icon = categoryIcons[displayCategory] || '📌';

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
                className="text-stone-600 hover:text-amber-600 transition"
              >
                Home
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

      {/* Category Header */}
      <section className="bg-gradient-to-br from-stone-900 to-stone-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition mb-6"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-5xl font-bold mb-4">
            {icon} {displayCategory}
          </h1>
          <p className="text-stone-300 text-lg max-w-2xl">
            Explore all our {displayCategory.toLowerCase()} events and find the
            perfect experience for you.
          </p>
        </div>
      </section>

      {/* Events Section */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin"></div>
            <p className="text-stone-600 mt-4">Loading events...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-8">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
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
              No upcoming events in this category
            </p>
            <p className="text-stone-500 mt-2">
              Check back soon for events in {displayCategory}
            </p>
            <Link
              href="/"
              className="inline-block mt-6 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-lg font-medium transition"
            >
              Browse All Events
            </Link>
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <p className="text-stone-600 text-lg">
                Showing {upcomingEvents.length} event
                {upcomingEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {upcomingEvents.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-stone-900 text-white mt-20">
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
                    Home
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
