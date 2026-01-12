'use client';

import { useState, useEffect, useRef } from 'react';
import { eventsAPI, ticketsAPI } from '@/lib/api';
import Link from 'next/link';
import jsQR from 'jsqr';

interface Event {
  _id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  totalSeats: number;
  soldTickets: number;
}

interface Ticket {
  _id: string;
  ticketNumber: string;
  eventId:
    | {
        _id: string;
        name: string;
        date: string;
        venue: string;
      }
    | string;
  seatNumber: string;
  buyerName: string;
  buyerEmail: string;
  purchaseDate: string;
  status: 'valid' | 'used' | 'expired';
  usedAt?: string;
}

type ActiveTab = 'dashboard' | 'events' | 'tickets' | 'scanner' | 'create';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [events, setEvents] = useState<Event[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search states
  const [eventSearch, setEventSearch] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [searchingTickets, setSearchingTickets] = useState(false);

  // QR Scanner states
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    ticket?: Ticket;
  } | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Create event form
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    date: '',
    venue: '',
    totalSeats: '',
  });

  // Stats for dashboard
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalTickets: 0,
    totalSeats: 0,
    soldPercentage: 0,
    validTickets: 0,
    usedTickets: 0,
  });

  useEffect(() => {
    fetchEvents();
    fetchAllTickets();
  }, []);

  useEffect(() => {
    const totalSeats = events.reduce((acc, e) => acc + e.totalSeats, 0);
    const soldSeats = events.reduce((acc, e) => acc + e.soldTickets, 0);
    const validCount = tickets.filter((t) => t.status === 'valid').length;
    const usedCount = tickets.filter((t) => t.status === 'used').length;

    setStats({
      totalEvents: events.length,
      totalTickets: tickets.length,
      totalSeats: totalSeats,
      soldPercentage:
        totalSeats > 0 ? Math.round((soldSeats / totalSeats) * 100) : 0,
      validTickets: validCount,
      usedTickets: usedCount,
    });
  }, [events, tickets]);

  const fetchEvents = async () => {
    try {
      const response = await eventsAPI.getAll();
      setEvents(response.data);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  const fetchAllTickets = async () => {
    setLoading(true);
    try {
      const response = await ticketsAPI.getAll();
      setTickets(response.data);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchTickets = async (query: string) => {
    if (!query.trim()) {
      fetchAllTickets();
      return;
    }

    setSearchingTickets(true);
    try {
      const response = await ticketsAPI.search(query);
      setTickets(response.data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchingTickets(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await eventsAPI.create({
        name: newEvent.name,
        description: newEvent.description,
        date: newEvent.date,
        venue: newEvent.venue,
        totalSeats: parseInt(newEvent.totalSeats),
      });

      setSuccess('Event created successfully!');
      setNewEvent({
        name: '',
        description: '',
        date: '',
        venue: '',
        totalSeats: '',
      });
      fetchEvents();
      setTimeout(() => setActiveTab('events'), 1500);
    } catch (err) {
      setError('Failed to create event. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await eventsAPI.delete(id);
      setSuccess('Event deleted successfully!');
      fetchEvents();
    } catch (err) {
      setError('Failed to delete event.');
      console.error(err);
    }
  };

  // QR Code scanning from uploaded image
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setScanResult(null);

    try {
      const image = new Image();
      image.src = URL.createObjectURL(file);

      await new Promise((resolve) => {
        image.onload = resolve;
      });

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code) {
        console.log('QR Code raw data:', code.data);

        // Parse the QR code data
        let ticketNumber: string | null = null;

        try {
          const qrData = JSON.parse(code.data);
          ticketNumber = qrData.ticketNumber;
        } catch {
          // If not JSON, check if it's just the ticket number directly
          if (code.data.startsWith('TK') && /^TK\d{6}$/.test(code.data)) {
            ticketNumber = code.data;
          } else {
            // Try to extract ticket number from any format
            const match = code.data.match(/TK\d{6}/);
            if (match) {
              ticketNumber = match[0];
            }
          }
        }

        if (ticketNumber) {
          try {
            // Validate the ticket via API
            const response = await ticketsAPI.validate(ticketNumber);
            setScanResult(response.data);

            // Refresh tickets list
            fetchAllTickets();
          } catch (apiErr: unknown) {
            console.error('API validation error:', apiErr);
            // Handle API errors - the backend might return error in response
            const axiosError = apiErr as {
              response?: { data?: { message?: string; success?: boolean } };
            };
            if (axiosError.response?.data) {
              setScanResult({
                success: false,
                message:
                  axiosError.response.data.message ||
                  'Ticket validation failed',
              });
            } else {
              setScanResult({
                success: false,
                message: `Failed to validate ticket ${ticketNumber}. Server error.`,
              });
            }
          }
        } else {
          setScanResult({
            success: false,
            message: `Invalid QR code format. Could not find ticket number.`,
          });
        }
      } else {
        setScanResult({
          success: false,
          message: 'No QR code found in the image. Please try a clearer image.',
        });
      }
    } catch (err) {
      console.error('Error scanning QR code:', err);
      setScanResult({
        success: false,
        message: 'Error processing image. Please try again.',
      });
    } finally {
      setScanning(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            Valid
          </span>
        );
      case 'used':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
            <span className="w-1.5 h-1.5 bg-stone-400 rounded-full"></span>
            Used
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
            {status}
          </span>
        );
    }
  };

  const filteredEvents = events.filter(
    (event) =>
      event.name.toLowerCase().includes(eventSearch.toLowerCase()) ||
      event.venue.toLowerCase().includes(eventSearch.toLowerCase())
  );

  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: (
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
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      ),
    },
    {
      id: 'events' as const,
      label: 'Events',
      icon: (
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
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      id: 'tickets' as const,
      label: 'Tickets',
      icon: (
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
            d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
          />
        </svg>
      ),
    },
    {
      id: 'scanner' as const,
      label: 'QR Scanner',
      icon: (
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
            d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
          />
        </svg>
      ),
    },
    {
      id: 'create' as const,
      label: 'Create Event',
      icon: (
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
            d="M12 4v16m8-8H4"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Hidden canvas for QR processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Navbar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <span className="text-white text-lg font-bold">G</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-stone-900">
                  Admin Portal
                </h1>
                <p className="text-xs text-stone-500 -mt-0.5">
                  Golden Moment Events
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-stone-600 hover:text-stone-900 transition flex items-center gap-2 text-sm"
              >
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                View Site
              </Link>
              <div className="w-8 h-8 bg-stone-200 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-stone-600"
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
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tab Navigation */}
        <nav className="flex gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-stone-200 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === item.id
                  ? 'bg-stone-900 text-white shadow-lg'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              &times;
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            {success}
            <button
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-500 hover:text-green-700"
            >
              &times;
            </button>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-stone-900 mb-2">
                Dashboard Overview
              </h2>
              <p className="text-stone-600">
                Welcome back! Here&apos;s what&apos;s happening with your
                events.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-stone-200">
                <div className="flex items-center justify-between mb-4">
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
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-stone-900">
                  {stats.totalEvents}
                </p>
                <p className="text-stone-500 text-sm">Total Events</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-stone-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-green-600"
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
                  </div>
                </div>
                <p className="text-3xl font-bold text-stone-900">
                  {stats.validTickets}
                </p>
                <p className="text-stone-500 text-sm">Valid Tickets</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-stone-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-stone-600"
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
                <p className="text-3xl font-bold text-stone-900">
                  {stats.usedTickets}
                </p>
                <p className="text-stone-500 text-sm">Used Tickets</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-stone-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-stone-900">
                  {stats.soldPercentage}%
                </p>
                <p className="text-stone-500 text-sm">Occupancy Rate</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white">
              <h3 className="text-lg font-bold mb-2">Quick Actions</h3>
              <p className="text-amber-100 text-sm mb-4">
                Scan tickets for entry validation
              </p>
              <button
                onClick={() => setActiveTab('scanner')}
                className="bg-white text-amber-600 px-6 py-3 rounded-xl font-semibold hover:bg-amber-50 transition flex items-center gap-2"
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
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
                Open QR Scanner
              </button>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-stone-200">
                <h3 className="text-lg font-bold text-stone-900 mb-4">
                  Recent Events
                </h3>
                {events.slice(0, 5).map((event) => (
                  <div
                    key={event._id}
                    className="flex items-center gap-4 py-3 border-b border-stone-100 last:border-0"
                  >
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 font-bold">
                      {new Date(event.date).getDate()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-900 truncate">
                        {event.name}
                      </p>
                      <p className="text-sm text-stone-500">{event.venue}</p>
                    </div>
                    <span className="text-sm text-stone-600">
                      {event.soldTickets}/{event.totalSeats}
                    </span>
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="text-stone-500 text-center py-4">
                    No events yet
                  </p>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 border border-stone-200">
                <h3 className="text-lg font-bold text-stone-900 mb-4">
                  Recent Tickets
                </h3>
                {tickets.slice(0, 5).map((ticket) => {
                  const eventInfo =
                    typeof ticket.eventId === 'object' ? ticket.eventId : null;
                  return (
                    <div
                      key={ticket._id}
                      className="flex items-center gap-4 py-3 border-b border-stone-100 last:border-0"
                    >
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-stone-900 truncate">
                          {ticket.buyerName}
                        </p>
                        <p className="text-sm text-stone-500">
                          {eventInfo?.name || 'Unknown Event'}
                        </p>
                      </div>
                      {getStatusBadge(ticket.status || 'valid')}
                    </div>
                  );
                })}
                {tickets.length === 0 && (
                  <p className="text-stone-500 text-center py-4">
                    No tickets sold yet
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Events</h2>
                <p className="text-stone-600">Manage all your events</p>
              </div>

              <div className="relative w-full md:w-80">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search events..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white text-stone-900"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Event
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Venue
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Tickets
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredEvents.map((event) => (
                      <tr
                        key={event._id}
                        className="hover:bg-stone-50 transition"
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-stone-900">
                            {event.name}
                          </p>
                          <p className="text-sm text-stone-500 line-clamp-1">
                            {event.description}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-stone-700">
                          {new Date(event.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 text-stone-700">
                          {event.venue}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-stone-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{
                                  width: `${
                                    (event.soldTickets / event.totalSeats) * 100
                                  }%`,
                                }}
                              ></div>
                            </div>
                            <span className="text-sm text-stone-600">
                              {event.soldTickets}/{event.totalSeats}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleDeleteEvent(event._id)}
                            className="text-red-600 hover:text-red-800 transition text-sm font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredEvents.length === 0 && (
                <div className="text-center py-12">
                  <svg
                    className="w-12 h-12 text-stone-300 mx-auto mb-4"
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
                  <p className="text-stone-500">No events found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Tickets</h2>
                <p className="text-stone-600">
                  View all sold tickets and their status
                </p>
              </div>

              <div className="relative w-full md:w-80">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search by ticket number, name, or email..."
                  value={ticketSearch}
                  onChange={(e) => {
                    setTicketSearch(e.target.value);
                    handleSearchTickets(e.target.value);
                  }}
                  className="w-full pl-12 pr-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white text-stone-900"
                />
                {searchingTickets && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-stone-200 border-t-amber-500 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Ticket #
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Event
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Buyer
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Seat
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {tickets.map((ticket) => {
                      const eventInfo =
                        typeof ticket.eventId === 'object'
                          ? ticket.eventId
                          : null;
                      return (
                        <tr
                          key={ticket._id}
                          className="hover:bg-stone-50 transition"
                        >
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200">
                              {ticket.ticketNumber}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-stone-700">
                            {eventInfo?.name || 'Unknown'}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-stone-900">
                              {ticket.buyerName}
                            </p>
                            <p className="text-sm text-stone-500">
                              {ticket.buyerEmail}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-stone-700">
                            {ticket.seatNumber}
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(ticket.status || 'valid')}
                          </td>
                          <td className="px-6 py-4">
                            <Link
                              href={`/receipt/${ticket._id}`}
                              className="text-amber-600 hover:text-amber-800 transition text-sm font-medium"
                            >
                              View Ticket
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {loading && (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
                  <p className="text-stone-500 mt-4">Loading tickets...</p>
                </div>
              )}
              {!loading && tickets.length === 0 && (
                <div className="text-center py-12">
                  <svg
                    className="w-12 h-12 text-stone-300 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                    />
                  </svg>
                  <p className="text-stone-500">No tickets found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QR Scanner Tab */}
        {activeTab === 'scanner' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-stone-900">
                QR Code Scanner
              </h2>
              <p className="text-stone-600">
                Upload a ticket QR code image to validate entry
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-8">
              {/* Upload Area */}
              <div
                className="border-2 border-dashed border-stone-300 rounded-2xl p-12 text-center hover:border-amber-400 transition cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                {scanning ? (
                  <div>
                    <div className="w-16 h-16 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-stone-600">Scanning QR code...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-amber-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-stone-900 mb-2">
                      Upload QR Code Image
                    </p>
                    <p className="text-stone-500 text-sm mb-4">
                      Click here or drag and drop an image
                    </p>
                    <button className="bg-amber-500 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-amber-600 transition">
                      Select Image
                    </button>
                  </>
                )}
              </div>

              {/* Scan Result */}
              {scanResult && (
                <div
                  className={`mt-6 p-6 rounded-2xl ${
                    scanResult.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        scanResult.success ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      {scanResult.success ? (
                        <svg
                          className="w-6 h-6 text-green-600"
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
                      ) : (
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
                      )}
                    </div>
                    <div className="flex-1">
                      <h3
                        className={`font-bold text-lg ${
                          scanResult.success ? 'text-green-800' : 'text-red-800'
                        }`}
                      >
                        {scanResult.success ? 'Entry Granted!' : 'Entry Denied'}
                      </h3>
                      <p
                        className={
                          scanResult.success ? 'text-green-700' : 'text-red-700'
                        }
                      >
                        {scanResult.message}
                      </p>

                      {scanResult.ticket && (
                        <div className="mt-4 p-4 bg-white rounded-xl">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-stone-500">Ticket Number</p>
                              <p className="font-mono font-bold text-stone-900">
                                {scanResult.ticket.ticketNumber}
                              </p>
                            </div>
                            <div>
                              <p className="text-stone-500">Attendee</p>
                              <p className="font-semibold text-stone-900">
                                {scanResult.ticket.buyerName}
                              </p>
                            </div>
                            <div>
                              <p className="text-stone-500">Seat</p>
                              <p className="font-semibold text-stone-900">
                                {scanResult.ticket.seatNumber}
                              </p>
                            </div>
                            <div>
                              <p className="text-stone-500">Status</p>
                              {getStatusBadge(scanResult.ticket.status)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="mt-8 p-4 bg-stone-50 rounded-xl">
                <h4 className="font-semibold text-stone-900 mb-3">
                  How to use:
                </h4>
                <ol className="space-y-2 text-sm text-stone-600">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      1
                    </span>
                    <span>
                      Ask the attendee to show their e-ticket (on phone or
                      printed)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      2
                    </span>
                    <span>
                      Take a photo of the QR code or have them send you the
                      ticket image
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      3
                    </span>
                    <span>Upload the image here to validate the ticket</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      4
                    </span>
                    <span>
                      If valid, the ticket will be marked as &quot;Used&quot;
                      and entry is granted
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Create Event Tab */}
        {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-stone-900">
                Create New Event
              </h2>
              <p className="text-stone-600">
                Fill in the details to create a new event
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-8">
              <form onSubmit={handleCreateEvent} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-2">
                    Event Name
                  </label>
                  <input
                    type="text"
                    value={newEvent.name}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, name: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                    placeholder="Enter event name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, description: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                    rows={4}
                    placeholder="Describe your event"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-2">
                      Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={newEvent.date}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, date: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-2">
                      Total Seats
                    </label>
                    <input
                      type="number"
                      value={newEvent.totalSeats}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, totalSeats: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                      placeholder="e.g., 100"
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-2">
                    Venue
                  </label>
                  <input
                    type="text"
                    value={newEvent.venue}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, venue: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                    placeholder="Enter venue address"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white py-4 rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Creating...
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Create Event
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
