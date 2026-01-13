'use client';

import { useState, useEffect } from 'react';
import { ticketsAPI } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Ticket {
  _id: string;
  ticketNumber: string;
  eventId: {
    _id: string;
    name: string;
    date: string;
    venue: string;
    description: string;
    category?: string;
  };
  seatNumber: string;
  buyerName: string;
  buyerEmail: string;
  purchaseDate: string;
  status: 'valid' | 'used' | 'expired';
  usedAt?: string;
}

export default function BackOfficeTicketPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setLoading(true);
        const response = await ticketsAPI.getById(ticketId);
        setTicket(response.data);
      } catch (err) {
        setError('Failed to load ticket details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [ticketId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-green-100 text-green-700 border border-green-200">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Valid - Entry Allowed
          </span>
        );
      case 'used':
        return (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-stone-100 text-stone-600 border border-stone-200">
            <span className="w-2 h-2 bg-stone-400 rounded-full"></span>
            Already Used
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-red-100 text-red-700 border border-red-200">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-stone-100 text-stone-600 border border-stone-200">
            {status}
          </span>
        );
    }
  };

  const getCategoryEmoji = (category?: string) => {
    switch (category) {
      case 'Movies':
        return '🎬';
      case 'Theatre':
        return '🎭';
      case 'Concert':
        return '🎵';
      case 'Sahra':
        return '🌙';
      default:
        return '📌';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-stone-600">Loading ticket details...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-stone-200 p-8 max-w-md w-full">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-stone-900 mb-2 text-center">
            {error || 'Ticket Not Found'}
          </h1>
          <p className="text-stone-600 text-center mb-6">
            The ticket you're looking for could not be found or loaded.
          </p>
          <Link
            href="/admin"
            className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold transition"
          >
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  const eventDate = new Date(ticket.eventId.date);
  const purchaseDate = new Date(ticket.purchaseDate);
  const usedDate = ticket.usedAt ? new Date(ticket.usedAt) : null;

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="text-stone-600 hover:text-stone-900 transition p-2 -ml-2"
              >
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-lg font-bold text-stone-900">
                  Ticket Details
                </h1>
                <p className="text-xs text-stone-500 -mt-0.5">
                  Back Office View
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="text-stone-600 hover:text-stone-900 transition p-2">
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
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4H7a2 2 0 01-2-2v-4a2 2 0 012-2h10a2 2 0 012 2v4a2 2 0 01-2 2zm0 0h2a2 2 0 002-2m0-4V9m0 4a2 2 0 01-2 2m2-2a2 2 0 00-2-2m0-4V5a2 2 0 012-2h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V9a2 2 0 01-2 2H9a2 2 0 01-2-2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Ticket Status Alert */}
        <div className="mb-6">{getStatusBadge(ticket.status)}</div>

        {/* Ticket Number Card */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-8 text-white mb-6">
          <p className="text-amber-100 text-sm mb-2">TICKET NUMBER</p>
          <p className="text-4xl font-mono font-bold tracking-wider">
            {ticket.ticketNumber}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Information */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-amber-600"
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
                Event Information
              </h2>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-stone-500 mb-1">Event Name</p>
                  <p className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                    <span className="text-2xl">
                      {getCategoryEmoji(ticket.eventId.category)}
                    </span>
                    {ticket.eventId.name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-stone-500 mb-1">Date & Time</p>
                    <p className="font-semibold text-stone-900">
                      {eventDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-stone-600">
                      {eventDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-stone-500 mb-1">Venue</p>
                    <p className="font-semibold text-stone-900">
                      {ticket.eventId.venue}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-stone-500 mb-1">Description</p>
                  <p className="text-stone-700 line-clamp-2">
                    {ticket.eventId.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Attendee Information */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Attendee Information
              </h2>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-stone-500 mb-1">Full Name</p>
                  <p className="text-lg font-semibold text-stone-900">
                    {ticket.buyerName}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-stone-500 mb-1">Email Address</p>
                  <p className="text-stone-700">
                    <a
                      href={`mailto:${ticket.buyerEmail}`}
                      className="text-amber-600 hover:text-amber-700 font-medium"
                    >
                      {ticket.buyerEmail}
                    </a>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
                  <div>
                    <p className="text-sm text-stone-500 mb-1">Seat Number</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {ticket.seatNumber}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-stone-500 mb-1">Category</p>
                    <p className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                      <span>{getCategoryEmoji(ticket.eventId.category)}</span>
                      {ticket.eventId.category || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Transaction Details
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-stone-500 mb-1">Purchase Date</p>
                    <p className="font-semibold text-stone-900">
                      {purchaseDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-stone-600">
                      {purchaseDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-stone-500 mb-1">
                      Current Status
                    </p>
                    <p className="font-semibold text-stone-900 capitalize">
                      {ticket.status}
                    </p>
                  </div>
                </div>

                {usedDate && (
                  <div className="pt-4 border-t border-stone-100">
                    <p className="text-sm text-stone-500 mb-1">Entry Time</p>
                    <p className="font-semibold text-stone-900">
                      {usedDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-stone-600">
                      {usedDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h3 className="font-bold text-stone-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg font-medium transition text-sm">
                  Mark as Used
                </button>
                <button className="w-full border border-stone-200 text-stone-700 hover:bg-stone-50 px-4 py-2.5 rounded-lg font-medium transition text-sm">
                  Print Ticket
                </button>
                <button className="w-full border border-stone-200 text-stone-700 hover:bg-stone-50 px-4 py-2.5 rounded-lg font-medium transition text-sm">
                  Send Email
                </button>
              </div>
            </div>

            {/* Status Summary */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h3 className="font-bold text-stone-900 mb-4">Status Summary</h3>

              <div
                className={`p-4 rounded-xl text-center ${
                  ticket.status === 'valid'
                    ? 'bg-green-50 border border-green-200'
                    : ticket.status === 'used'
                    ? 'bg-stone-50 border border-stone-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div
                  className={`text-sm font-semibold mb-1 ${
                    ticket.status === 'valid'
                      ? 'text-green-700'
                      : ticket.status === 'used'
                      ? 'text-stone-700'
                      : 'text-red-700'
                  }`}
                >
                  {ticket.status === 'valid'
                    ? 'Entry Allowed'
                    : ticket.status === 'used'
                    ? 'Entry Completed'
                    : 'Entry Denied'}
                </div>
                <p className="text-xs text-stone-600">
                  {ticket.status === 'valid'
                    ? 'This ticket has not been used yet'
                    : ticket.status === 'used'
                    ? 'This ticket has been scanned'
                    : 'This ticket is no longer valid'}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-stone-100 text-xs text-stone-600">
                <p className="mb-2">
                  <strong>Last Updated:</strong>{' '}
                  {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Support */}
            <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6">
              <h3 className="font-bold text-stone-900 mb-3">Need Help?</h3>
              <p className="text-sm text-stone-600 mb-4">
                Contact support if you have any questions about this ticket.
              </p>
              <button className="w-full text-amber-600 hover:text-amber-700 font-medium text-sm">
                Contact Support →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
