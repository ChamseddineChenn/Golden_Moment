'use client';

import { useState, useEffect, useRef } from 'react';
import { eventsAPI, ticketsAPI } from '@/lib/api';
import Link from 'next/link';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface Event {
  _id: string;
  name: string;
  description: string;
  longDescription?: string;
  coverImage?: string;
  coverImagePublicId?: string;
  date: string;
  venue: string;
  soldTickets: number;
  totalSeats?: number;
  ticketTypes?: {
    Free: { enabled: boolean; price?: number };
    Standard: { enabled: boolean; price?: number };
    EarlyBird: { enabled: boolean; price?: number; limit?: number };
    VIP: { enabled: boolean; price?: number };
  };
  earlyBirdCount?: number;
  category?: string;
  isDraft?: boolean;
  isPublished?: boolean;
  seatingLayout?: Array<any>;
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
  seats: Array<{ sectionId?: string; seatId: string }>;
  buyerName: string;
  buyerEmail: string;
  purchaseDate: string;
  totalPrice?: number;
  status: 'valid' | 'used' | 'expired';
  usedAt?: string;
  createdAt?: string;
  expiresAt?: string;
}

type ActiveTab = 'dashboard' | 'events' | 'tickets' | 'scanner' | 'create';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);

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
  const [showCameraModal, setShowCameraModal] = useState(false);
  const qrScannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Event editing and preview states
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [previewEvent, setPreviewEvent] = useState<Event | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Create event form
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    longDescription: '',
    coverImage: '',
    coverImagePublicId: '',
    coverImageFile: null as File | null,
    date: '',
    venue: '',
    ticketTypes: {
      Free: { enabled: true, price: 0 as string | number },
      Standard: { enabled: false, price: '' as string | number },
      EarlyBird: {
        enabled: false,
        price: '' as string | number,
        limit: '' as string | number,
      },
      VIP: { enabled: false, price: '' as string | number },
    },
    category: 'Concert',
    isDraft: true,
    seatingEnabled: false,
    totalSeats: '' as string | number,
    sections: [] as Array<{
      id: string;
      name: string;
      orientation: 'vertical' | 'horizontal';
      columns: number;
      rows: number;
      priceModifier: number;
      accessibility: boolean;
    }>,
  });

  // Stats for dashboard
  const [stats, setStats] = useState({
    totalEvents: 0,
    eventsThisYear: 0,
    eventsThisMonth: 0,
    eventsThisWeek: 0,
    eventsToday: 0,
    yearChange: 0,
    monthChange: 0,
    weekChange: 0,
    dayChange: 0,
    totalTickets: 0,
    totalSeats: 0,
    soldPercentage: 0,
    revenueThisYear: 0,
    revenueThisMonth: 0,
    revenueLastYear: 0,
    revenueLastMonth: 0,
    revenueYearChange: 0,
    revenueMonthChange: 0,
    attendanceByCategory: {} as Record<string, number>,
    ticketsByCategory: {} as Record<string, number>,
    eventsByCategory: {} as Record<string, number>,
  });

  useEffect(() => {
    fetchEvents();
    fetchAllTickets();
  }, []);

  useEffect(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekAgo = new Date(weekStart);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    let monthAgoYear = now.getFullYear();
    let monthAgoMonth = now.getMonth() - 1;
    if (monthAgoMonth < 0) {
      monthAgoMonth = 11;
      monthAgoYear = now.getFullYear() - 1;
    }
    const monthAgo = new Date(monthAgoYear, monthAgoMonth, 1);

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearAgo = new Date(now.getFullYear() - 1, 0, 1);

    // Count events by time period
    const eventsToday = events.filter((e) => {
      const eventDate = new Date(e.date);
      return (
        eventDate >= today &&
        eventDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)
      );
    }).length;

    const eventsYesterday = events.filter((e) => {
      const eventDate = new Date(e.date);
      return eventDate >= yesterday && eventDate < today;
    }).length;

    const eventsThisWeek = events.filter((e) => {
      const eventDate = new Date(e.date);
      return eventDate >= weekStart;
    }).length;

    const eventsLastWeek = events.filter((e) => {
      const eventDate = new Date(e.date);
      return eventDate >= weekAgo && eventDate < weekStart;
    }).length;

    const eventsThisMonth = events.filter((e) => {
      const eventDate = new Date(e.date);
      return eventDate >= monthStart;
    }).length;

    const eventsLastMonth = events.filter((e) => {
      const eventDate = new Date(e.date);
      return eventDate >= monthAgo && eventDate < monthStart;
    }).length;

    const eventsThisYear = events.filter((e) => {
      const eventDate = new Date(e.date);
      return eventDate >= yearStart;
    }).length;

    const eventsLastYear = events.filter((e) => {
      const eventDate = new Date(e.date);
      const eventYear = eventDate.getFullYear();
      return eventYear === now.getFullYear() - 1;
    }).length;

    // Calculate percentage changes
    const dayChange =
      eventsYesterday > 0
        ? Math.round(((eventsToday - eventsYesterday) / eventsYesterday) * 100)
        : eventsToday > 0
        ? 100
        : 0;
    const weekChange =
      eventsLastWeek > 0
        ? Math.round(((eventsThisWeek - eventsLastWeek) / eventsLastWeek) * 100)
        : eventsThisWeek > 0
        ? 100
        : 0;
    const monthChange =
      eventsLastMonth > 0
        ? Math.round(
            ((eventsThisMonth - eventsLastMonth) / eventsLastMonth) * 100
          )
        : eventsThisMonth > 0
        ? 100
        : 0;
    const yearChange =
      eventsLastYear > 0
        ? Math.round(((eventsThisYear - eventsLastYear) / eventsLastYear) * 100)
        : eventsThisYear > 0
        ? 100
        : 0;

    // Calculate attendance and ticket rates by category
    const attendanceByCategory: Record<string, number> = {};
    const ticketsByCategory: Record<string, number> = {};
    const eventsByCategory: Record<string, number> = {};

    const categories = ['Movies', 'Theatre', 'Concert', 'Sahra'];
    categories.forEach((cat) => {
      const categoryEvents = events.filter((e) => {
        // Debug: log if category doesn't exist
        const eventCategory = e.category || 'Concert';
        return eventCategory === cat;
      });
      eventsByCategory[cat] = categoryEvents.length;

      const categoryTickets = tickets.filter((t) => {
        const eventId =
          typeof t.eventId === 'object' ? t.eventId._id : t.eventId;
        return categoryEvents.some((e) => e._id === eventId);
      });
      ticketsByCategory[cat] = categoryTickets.length;
      attendanceByCategory[cat] = categoryTickets.filter(
        (t) => t.status === 'used'
      ).length;
    });

    console.log('DEBUG eventsByCategory:', eventsByCategory);

    // Calculate total revenue this year (based on tickets created/sold this year)
    const revenueThisYear = tickets
      .filter((t) => {
        const ticketDate = new Date(t.createdAt || t.purchaseDate);
        return ticketDate >= yearStart;
      })
      .reduce((acc, t) => acc + (t.totalPrice || 0), 0);

    // Calculate revenue last year (based on tickets created/sold last year)
    const revenueLastYear = tickets
      .filter((t) => {
        const ticketDate = new Date(t.createdAt || t.purchaseDate);
        const ticketYear = ticketDate.getFullYear();
        return ticketYear === now.getFullYear() - 1;
      })
      .reduce((acc, t) => acc + (t.totalPrice || 0), 0);

    // Calculate revenue this month (based on tickets created/sold this month)
    const revenueThisMonth = tickets
      .filter((t) => {
        const ticketDate = new Date(t.createdAt || t.purchaseDate);
        return ticketDate >= monthStart && ticketDate < monthEnd;
      })
      .reduce((acc, t) => acc + (t.totalPrice || 0), 0);

    // Calculate revenue last month (based on tickets created/sold last month)
    const revenueLastMonth = tickets
      .filter((t) => {
        const ticketDate = new Date(t.createdAt || t.purchaseDate);
        return ticketDate >= monthAgo && ticketDate < monthStart;
      })
      .reduce((acc, t) => acc + (t.totalPrice || 0), 0);

    // Calculate revenue percentage changes
    const revenueYearChange =
      revenueLastYear > 0
        ? Math.round(
            ((revenueThisYear - revenueLastYear) / revenueLastYear) * 100
          )
        : 0;

    const revenueMonthChange =
      revenueLastMonth > 0
        ? Math.round(
            ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
          )
        : 0;

    const soldSeats = events.reduce((acc, e) => acc + e.soldTickets, 0);

    setStats({
      totalEvents: events.length,
      eventsThisYear,
      eventsThisMonth,
      eventsThisWeek,
      eventsToday,
      yearChange,
      monthChange,
      weekChange,
      dayChange,
      totalTickets: tickets.length,
      totalSeats: soldSeats,
      soldPercentage:
        soldSeats > 0 ? Math.round((soldSeats / soldSeats) * 100) : 0,
      revenueThisYear,
      revenueThisMonth,
      revenueLastYear,
      revenueLastMonth,
      revenueYearChange,
      revenueMonthChange,
      attendanceByCategory,
      ticketsByCategory,
      eventsByCategory,
    });
  }, [events, tickets]);

  const fetchEvents = async () => {
    try {
      const response = await eventsAPI.getAllAdmin();
      // Debug: log events to see their structure
      console.log('Fetched events:', response.data);
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

  // Section management functions
  const addSection = () => {
    const newSection = {
      id: `section_${Date.now()}`,
      name: `Section ${newEvent.sections.length + 1}`,
      orientation: 'horizontal' as const,
      columns: 10,
      rows: 5,
      priceModifier: 0,
      accessibility: false,
    };
    setNewEvent({ ...newEvent, sections: [...newEvent.sections, newSection] });
  };

  const removeSection = (id: string) => {
    setNewEvent({
      ...newEvent,
      sections: newEvent.sections.filter((s) => s.id !== id),
    });
  };

  const updateSection = (
    id: string,
    updates: Partial<(typeof newEvent.sections)[0]>
  ) => {
    setNewEvent({
      ...newEvent,
      sections: newEvent.sections.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    });
  };

  const calculateTotalSeatsFromSections = () => {
    return newEvent.sections.reduce((total, section) => {
      return total + section.columns * section.rows;
    }, 0);
  };

  const handleCoverImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const { uploadImage } = await import('@/lib/api');
      const uploadResult = await uploadImage(file);
      setNewEvent((prev) => ({
        ...prev,
        coverImage: uploadResult.secure_url,
        coverImagePublicId: uploadResult.public_id,
        coverImageFile: file,
      }));
      toast.success('Cover image uploaded successfully!');
    } catch (err) {
      toast.error(
        'Failed to upload cover image. Check Cloudinary configuration.'
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCreatingEvent(true);

    try {
      // Validate that at least one ticket type is enabled
      const hasEnabledTicketType =
        newEvent.ticketTypes.Free.enabled ||
        newEvent.ticketTypes.Standard.enabled ||
        newEvent.ticketTypes.EarlyBird.enabled ||
        newEvent.ticketTypes.VIP.enabled;

      if (!hasEnabledTicketType) {
        toast.error('Please select at least one ticket type for this event.');
        setLoading(false);
        setCreatingEvent(false);
        return;
      }

      // Convert ticketTypes prices from strings to numbers
      const ticketTypes = {
        Free: { enabled: newEvent.ticketTypes.Free.enabled, price: 0 },
        Standard: {
          enabled: newEvent.ticketTypes.Standard.enabled,
          price: newEvent.ticketTypes.Standard.enabled
            ? parseFloat(newEvent.ticketTypes.Standard.price as string) || 0
            : 0,
        },
        EarlyBird: {
          enabled: newEvent.ticketTypes.EarlyBird.enabled,
          price: newEvent.ticketTypes.EarlyBird.enabled
            ? parseFloat(newEvent.ticketTypes.EarlyBird.price as string) || 0
            : 0,
          limit: newEvent.ticketTypes.EarlyBird.enabled
            ? parseInt(newEvent.ticketTypes.EarlyBird.limit as string) || 0
            : 0,
        },
        VIP: {
          enabled: newEvent.ticketTypes.VIP.enabled,
          price: newEvent.ticketTypes.VIP.enabled
            ? parseFloat(newEvent.ticketTypes.VIP.price as string) || 0
            : 0,
        },
      };

      const eventData: any = {
        name: newEvent.name,
        description: newEvent.description,
        longDescription: newEvent.longDescription,
        coverImage: newEvent.coverImage,
        coverImagePublicId: newEvent.coverImagePublicId,
        date: newEvent.date,
        venue: newEvent.venue,
        ticketTypes,
        category: newEvent.category,
        isDraft: newEvent.isDraft,
        isPublished: !newEvent.isDraft,
      };

      // Add seating layout if enabled and calculate totalSeats
      if (newEvent.seatingEnabled && newEvent.sections.length > 0) {
        eventData.seatingLayout = {
          enabled: true,
          sections: newEvent.sections,
        };
        // Calculate total seats from sections
        eventData.totalSeats = newEvent.sections.reduce(
          (total, section) => total + section.columns * section.rows,
          0
        );
      } else if (!newEvent.seatingEnabled && newEvent.totalSeats) {
        // For standing room events without visual seating, use manual totalSeats
        eventData.totalSeats = parseInt(newEvent.totalSeats as string) || 0;
      } else {
        // If no seating layout and no manual seats, default to 0
        eventData.totalSeats = 0;
      }

      // If editing, call update endpoint instead of create
      if (editingEventId) {
        await eventsAPI.update(editingEventId, eventData);
        toast.success('Event updated successfully!');
      } else {
        const response = await eventsAPI.create(eventData);

        // Initialize seats if seating is enabled
        if (newEvent.seatingEnabled && newEvent.sections.length > 0) {
          await fetch(
            `http://localhost:3002/seats/event/${response.data._id}/initialize`,
            {
              method: 'POST',
            }
          );
        }

        toast.success('Event created successfully!');
      }

      setNewEvent({
        name: '',
        description: '',
        longDescription: '',
        coverImage: '',
        coverImagePublicId: '',
        coverImageFile: null,
        date: '',
        venue: '',
        ticketTypes: {
          Free: { enabled: true, price: 0 },
          Standard: { enabled: false, price: '' },
          EarlyBird: { enabled: false, price: '', limit: '' },
          VIP: { enabled: false, price: '' },
        },
        category: 'Concert',
        isDraft: true,
        seatingEnabled: false,
        totalSeats: '',
        sections: [],
      });
      setEditingEventId(null);
      fetchEvents();
      setTimeout(() => setActiveTab('events'), 1500);
    } catch (err) {
      toast.error('Failed to save event. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
      setCreatingEvent(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await eventsAPI.delete(id);
      toast.success('Event deleted successfully!');
      fetchEvents();
    } catch (err) {
      toast.error('Failed to delete event.');
      console.error(err);
    }
  };

  const handleDeleteTicket = async (id: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this ticket? This will also free up the reserved seats.'
      )
    )
      return;

    try {
      setLoading(true);
      await ticketsAPI.delete(id);
      toast.success(
        'Ticket deleted successfully! Seats and counts have been updated.'
      );
      // Refresh the tickets list
      const allTickets = await ticketsAPI.getAll();
      setTickets(allTickets.data);
    } catch (err) {
      toast.error('Failed to delete ticket.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishEvent = async (id: string) => {
    try {
      await eventsAPI.update(id, {
        isDraft: false,
        isPublished: true,
      });
      toast.success('Event published successfully!');
      fetchEvents();
    } catch (err) {
      toast.error('Failed to publish event.');
      console.error(err);
    }
  };

  const handleUnpublishEvent = async (id: string) => {
    try {
      await eventsAPI.update(id, {
        isDraft: true,
        isPublished: false,
      });
      toast.success('Event unpublished and moved to draft.');
      fetchEvents();
    } catch (err) {
      toast.error('Failed to unpublish event.');
      console.error(err);
    }
  };

  // QR Code scanning from camera
  const openCameraScanner = () => {
    setShowCameraModal(true);
    setScanResult(null);
  };

  const closeCameraScanner = () => {
    setShowCameraModal(false);
    if (qrScannerRef.current) {
      qrScannerRef.current.clear();
      qrScannerRef.current = null;
    }
  };

  // Initialize camera scanner when modal opens
  useEffect(() => {
    if (!showCameraModal) return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    qrScannerRef.current = scanner;

    scanner.render(
      async (encryptedToken: string) => {
        // Scanner found a QR code
        console.log('QR Code scanned:', encryptedToken);
        setScanning(true);

        try {
          // Validate the ticket via API using encrypted token
          const response = await fetch(
            'http://localhost:3002/tickets/validate-qr',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ encryptedToken }),
            }
          );
          const data = await response.json();
          setScanResult(data);

          // Refresh tickets list
          fetchAllTickets();

          // Clear scanner for next scan
          if (qrScannerRef.current) {
            qrScannerRef.current.clear();
          }
        } catch (apiErr: unknown) {
          console.error('API validation error:', apiErr);
          setScanResult({
            success: false,
            message: 'Failed to validate ticket. Server error.',
          });
        } finally {
          setScanning(false);
        }
      },
      (error: string) => {
        // Error is normal (scanning in progress), only log if severe
        console.debug('Scanner error:', error);
      }
    );

    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.clear();
        qrScannerRef.current = null;
      }
    };
  }, [showCameraModal]);

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
      {/* Top Navbar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 md:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <span className="text-white text-lg font-bold">G</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-base md:text-lg font-bold text-stone-900 truncate">
                  Admin Portal
                </h1>
                <p className="text-xs text-stone-500 -mt-0.5 hidden sm:block">
                  Golden Moment Events
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              <Link
                href="/"
                className="text-stone-600 hover:text-stone-900 transition flex items-center gap-1 md:gap-2 text-xs md:text-sm p-2"
                title="View public site"
              >
                <svg
                  className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0"
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
                <span className="hidden sm:inline">View Site</span>
              </Link>
              <div className="w-8 h-8 md:w-10 md:h-10 bg-stone-200 rounded-full flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 md:w-5 md:h-5 text-stone-600"
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

      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Left Sidebar Navigation */}
        <aside
          className={`${
            sidebarOpen ? 'w-56' : 'w-20'
          } bg-white border-r border-stone-200 p-3 hidden lg:flex flex-col transition-all duration-300`}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-3 rounded-xl hover:bg-stone-100 transition mb-4"
            title={sidebarOpen ? 'Collapse' : 'Expand'}
          >
            {sidebarOpen ? (
              <svg
                className="w-5 h-5 text-stone-600"
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
            ) : (
              <svg
                className="w-5 h-5 text-stone-600"
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
            )}
          </button>
          <nav className="space-y-2 flex-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={!sidebarOpen ? item.label : ''}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === item.id
                    ? 'bg-amber-100 text-amber-700 border-l-4 border-amber-600'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {item.icon}
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {/* Mobile Tab Navigation */}
          <nav className="lg:hidden flex gap-1 p-3 md:p-4 bg-white border-b border-stone-200 overflow-x-auto snap-x snap-mandatory">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1 px-3 py-2 md:px-4 md:py-2 rounded-lg font-medium transition-all whitespace-nowrap text-xs md:text-sm flex-shrink-0 snap-start ${
                  activeTab === item.id
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-3 md:p-6">
            {/* Alerts */}
            <ToastContainer
              position="top-right"
              autoClose={4000}
              hideProgressBar={false}
              newestOnTop={true}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
            {/* Alerts */}
            <ToastContainer
              position="top-right"
              autoClose={4000}
              hideProgressBar={false}
              newestOnTop={true}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="space-y-4 md:space-y-6 flex flex-col">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-stone-900 mb-2">
                    Dashboard Overview
                  </h2>
                  <p className="text-sm md:text-base text-stone-600">
                    Welcome back! Here&apos;s what&apos;s happening with your
                    events.
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="w-full bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-3 md:p-4 text-white flex flex-col md:flex-row md:items-center gap-3">
                  <div>
                    <p className="text-sm font-semibold">Quick Actions</p>
                    <p className="text-xs text-amber-100">Validate tickets</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('scanner')}
                    className="bg-white text-amber-600 px-3 py-2 md:px-4 md:py-2 rounded-lg font-semibold text-sm hover:bg-amber-50 transition flex items-center gap-2 whitespace-nowrap justify-center md:justify-start"
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
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                      />
                    </svg>
                    Scan QR Code
                  </button>
                  <button
                    onClick={() => {
                      fetchEvents();
                      fetchAllTickets();
                    }}
                    className="bg-white/20 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg font-semibold text-sm hover:bg-white/30 transition flex items-center gap-2 whitespace-nowrap md:ml-auto justify-center md:justify-start"
                    title="Refresh dashboard data"
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>

                {/* Stats Grid - Time-Based */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
                    Events Timeline
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Today */}
                    <div className="bg-white rounded-xl p-4 border border-stone-200">
                      <p className="text-sm font-semibold text-stone-900 mb-3">
                        Today
                      </p>
                      <p className="text-2xl font-bold text-stone-900">
                        {stats.eventsToday}
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        events scheduled
                      </p>
                    </div>

                    {/* This Week */}
                    <div className="bg-white rounded-xl p-4 border border-stone-200">
                      <p className="text-sm font-semibold text-stone-900 mb-3">
                        This Week
                      </p>
                      <p className="text-2xl font-bold text-stone-900">
                        {stats.eventsThisWeek}
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        events scheduled
                      </p>
                    </div>

                    {/* This Month */}
                    <div className="bg-white rounded-xl p-4 border border-stone-200">
                      <p className="text-sm font-semibold text-stone-900 mb-3">
                        This Month
                      </p>
                      <p className="text-2xl font-bold text-stone-900">
                        {stats.eventsThisMonth}
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        events scheduled
                      </p>
                    </div>

                    {/* This Year */}
                    <div className="bg-white rounded-xl p-4 border border-stone-200">
                      <p className="text-sm font-semibold text-stone-900 mb-3">
                        This Year
                      </p>
                      <p className="text-2xl font-bold text-stone-900">
                        {stats.eventsThisYear}
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        events scheduled
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats Grid - Main Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-stone-200">
                    <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2">
                      Total Events
                    </p>
                    <p className="text-3xl font-bold text-stone-900 mb-1">
                      {stats.totalEvents}
                    </p>
                    <p className="text-stone-500 text-sm">All time</p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200">
                    <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2">
                      Total Tickets Bought
                    </p>
                    <p className="text-3xl font-bold text-blue-600 mb-1">
                      {stats.totalTickets}
                    </p>
                    <p className="text-stone-500 text-sm">All events</p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                        Revenue This Year
                      </p>
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                          stats.revenueYearChange >= 0
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {stats.revenueYearChange >= 0 ? '+' : ''}
                        {stats.revenueYearChange}%
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-green-600 mb-1">
                      ${stats.revenueThisYear.toFixed(0)}
                    </p>
                    <p className="text-stone-500 text-sm">vs last year</p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                        Revenue This Month
                      </p>
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                          stats.revenueMonthChange >= 0
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {stats.revenueMonthChange >= 0 ? '+' : ''}
                        {stats.revenueMonthChange}%
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-green-600 mb-1">
                      ${stats.revenueThisMonth.toFixed(0)}
                    </p>
                    <p className="text-stone-500 text-sm">vs last month</p>
                  </div>
                </div>

                {/* Category Performance Grid */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
                    Category Performance
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['Movies', 'Theatre', 'Concert', 'Sahra'].map(
                      (category) => {
                        const events = stats.eventsByCategory[category] || 0;
                        const tickets = stats.ticketsByCategory[category] || 0;
                        const attendance =
                          stats.attendanceByCategory[category] || 0;
                        const emoji =
                          category === 'Movies'
                            ? '🎬'
                            : category === 'Theatre'
                            ? '🎭'
                            : category === 'Concert'
                            ? '🎵'
                            : '🌙';

                        return (
                          <div
                            key={category}
                            className="bg-white rounded-2xl p-5 border border-stone-200"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <p className="text-2xl mb-1">{emoji}</p>
                                <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                                  {category}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-stone-600">
                                    Events
                                  </span>
                                  <span className="text-sm font-bold text-stone-900">
                                    {events}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-stone-600">
                                    Tickets Sold
                                  </span>
                                  <span className="text-sm font-bold text-stone-900">
                                    {tickets}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-stone-600">
                                    Attendance
                                  </span>
                                  <span className="text-sm font-bold text-stone-900">
                                    {attendance}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                                    style={{ width: `${attendance}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Category Distribution Chart - Pie Chart */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
                    Events by Category
                  </h3>
                  <div className="bg-white rounded-2xl p-8 border border-stone-200">
                    {stats.totalEvents === 0 ? (
                      <div className="flex items-center justify-center py-12">
                        <p className="text-stone-500 text-center">
                          No events created yet
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col lg:flex-row items-center justify-center gap-12">
                        {/* Pie Chart SVG */}
                        <div className="flex items-center justify-center">
                          <svg width="200" height="200" viewBox="0 0 200 200">
                            {(() => {
                              const categories = [
                                'Movies',
                                'Theatre',
                                'Concert',
                                'Sahra',
                              ];
                              const colors = {
                                Movies: '#EF4444',
                                Theatre: '#A855F7',
                                Concert: '#EC4899',
                                Sahra: '#FBBF24',
                              };
                              const eventCounts = categories.map(
                                (cat) => stats.eventsByCategory[cat] || 0
                              );
                              const total = eventCounts.reduce(
                                (a, b) => a + b,
                                0
                              );

                              if (total === 0) {
                                return (
                                  <>
                                    <circle
                                      cx="100"
                                      cy="100"
                                      r="80"
                                      fill="none"
                                      stroke="#E7E5E4"
                                      strokeWidth="2"
                                    />
                                    <circle
                                      cx="100"
                                      cy="100"
                                      r="50"
                                      fill="white"
                                    />
                                  </>
                                );
                              }

                              const circumference = 2 * Math.PI * 80;
                              let offset = 0;

                              return [
                                ...categories
                                  .map((category, idx) => {
                                    const count = eventCounts[idx];
                                    if (count === 0) return null; // Don't render empty segments

                                    const percentage = (count / total) * 100;
                                    const strokeDashoffset = offset;
                                    const strokeDasharray =
                                      (percentage / 100) * circumference;

                                    offset += strokeDasharray;

                                    return (
                                      <circle
                                        key={category}
                                        cx="100"
                                        cy="100"
                                        r="80"
                                        fill="none"
                                        stroke={
                                          colors[
                                            category as keyof typeof colors
                                          ]
                                        }
                                        strokeWidth="20"
                                        strokeDasharray={strokeDasharray}
                                        strokeDashoffset={-strokeDashoffset}
                                        style={{ transition: 'all 0.3s ease' }}
                                      />
                                    );
                                  })
                                  .filter(Boolean),
                                <circle
                                  key="center"
                                  cx="100"
                                  cy="100"
                                  r="50"
                                  fill="white"
                                />,
                              ];
                            })()}
                          </svg>
                        </div>

                        {/* Legend */}
                        <div className="space-y-4 w-full lg:w-auto">
                          {['Movies', 'Theatre', 'Concert', 'Sahra'].map(
                            (category) => {
                              const events =
                                stats.eventsByCategory[category] || 0;
                              const total = stats.totalEvents || 1;
                              const percentage = Math.round(
                                (events / total) * 100
                              );
                              const colorMap = {
                                Movies: 'bg-red-500',
                                Theatre: 'bg-purple-500',
                                Concert: 'bg-pink-500',
                                Sahra: 'bg-amber-400',
                              };
                              const emoji =
                                category === 'Movies'
                                  ? '🎬'
                                  : category === 'Theatre'
                                  ? '🎭'
                                  : category === 'Concert'
                                  ? '🎵'
                                  : '🌙';

                              return (
                                <div
                                  key={category}
                                  className="flex items-center justify-between gap-4"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-3 h-3 rounded-full ${
                                        colorMap[
                                          category as keyof typeof colorMap
                                        ]
                                      }`}
                                    ></div>
                                    <span className="text-sm font-semibold text-stone-700">
                                      {emoji} {category}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-stone-900">
                                      {events}
                                    </p>
                                    <p className="text-xs text-stone-600">
                                      {percentage}%
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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
                          <p className="text-sm text-stone-500">
                            {event.venue}
                          </p>
                        </div>
                        <span className="text-sm text-stone-600">
                          {event.soldTickets} sold
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
                    {tickets
                      .slice()
                      .sort((a, b) => {
                        const aTime = new Date(
                          a.createdAt || a.purchaseDate || 0
                        ).getTime();
                        const bTime = new Date(
                          b.createdAt || b.purchaseDate || 0
                        ).getTime();
                        return bTime - aTime; // Newest first
                      })
                      .slice(0, 5)
                      .map((ticket) => {
                        const eventInfo =
                          typeof ticket.eventId === 'object'
                            ? ticket.eventId
                            : null;
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
              <div className="space-y-4 md:space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-stone-900">
                      Events
                    </h2>
                    <p className="text-sm md:text-base text-stone-600">Manage all your events</p>
                  </div>

                  <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                    <button
                      onClick={() => fetchEvents()}
                      className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-medium text-sm whitespace-nowrap"
                      title="Refresh events list"
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
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Refresh
                    </button>
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
                            Category
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                            Tickets
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                            Attendance
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filteredEvents.map((event) => {
                          // Calculate per-event stats
                          const eventTickets = tickets.filter((t) => {
                            const eventId =
                              typeof t.eventId === 'object'
                                ? t.eventId._id
                                : t.eventId;
                            return eventId === event._id;
                          });
                          const usedTickets = eventTickets.filter(
                            (t) => t.status === 'used'
                          ).length;
                          const attendanceRate =
                            eventTickets.length > 0
                              ? Math.round(
                                  (usedTickets / eventTickets.length) * 100
                                )
                              : 0;

                          // Get category ticket sales
                          const categoryEvents = events.filter(
                            (e) => e.category === event.category
                          );
                          const totalCategorySold = categoryEvents.reduce(
                            (acc, e) => acc + e.soldTickets,
                            0
                          );
                          const categoryOccupancyRate =
                            totalCategorySold > 0
                              ? Math.round(
                                  (totalCategorySold / categoryEvents.length) *
                                    100
                                )
                              : 0;

                          return (
                            <tr
                              key={event._id}
                              className="hover:bg-stone-50 transition"
                            >
                              <td className="px-6 py-4">
                                <p className="font-medium text-stone-900">
                                  {event.name}
                                </p>
                                <p className="text-sm text-stone-500 line-clamp-1">
                                  {event.venue}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  {event.isDraft && (
                                    <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                                      Draft
                                    </span>
                                  )}
                                  {!event.isDraft && event.isPublished && (
                                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                      Published
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm font-medium">
                                  {event.category === 'Movies' && '🎬'}
                                  {event.category === 'Theatre' && '🎭'}
                                  {event.category === 'Concert' && '🎵'}
                                  {event.category === 'Sahra' && '🌙'}
                                  {event.category || 'N/A'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-stone-700">
                                {new Date(event.date).toLocaleDateString(
                                  'en-US',
                                  {
                                    month: 'short',
                                    day: 'numeric',
                                  }
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 w-20 h-2 bg-stone-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-amber-500 rounded-full"
                                      style={{
                                        width: `${categoryOccupancyRate}%`,
                                      }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-medium text-stone-600 w-12">
                                    {categoryOccupancyRate}%
                                  </span>
                                </div>
                                <p className="text-xs text-stone-500 mt-1">
                                  {event.category} avg
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 w-20 h-2 bg-green-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-green-500 rounded-full"
                                      style={{
                                        width: `${attendanceRate}%`,
                                      }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-medium text-stone-600 w-12">
                                    {attendanceRate}%
                                  </span>
                                </div>
                                <p className="text-xs text-stone-500 mt-1">
                                  {usedTickets}/{eventTickets.length}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  {!event.isDraft && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const updates = {
                                            isDraft: true,
                                            isPublished: false,
                                          };
                                          await eventsAPI.update(
                                            event._id,
                                            updates
                                          );
                                          fetchEvents();
                                        } catch (error) {
                                          console.error(
                                            'Error unpublishing event:',
                                            error
                                          );
                                        }
                                      }}
                                      className="text-xs px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition font-medium"
                                      title="Unpublish event"
                                    >
                                      Unpublish
                                    </button>
                                  )}
                                  {event.isDraft && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const updates = {
                                            isDraft: false,
                                            isPublished: true,
                                          };
                                          await eventsAPI.update(
                                            event._id,
                                            updates
                                          );
                                          fetchEvents();
                                        } catch (error) {
                                          console.error(
                                            'Error publishing event:',
                                            error
                                          );
                                        }
                                      }}
                                      className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded transition font-medium"
                                      title="Publish event"
                                    >
                                      Publish
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingEventId(event._id);
                                      setNewEvent({
                                        name: event.name,
                                        description: event.description,
                                        longDescription:
                                          event.longDescription || '',
                                        coverImage: event.coverImage || '',
                                        coverImagePublicId:
                                          event.coverImagePublicId || '',
                                        coverImageFile: null,
                                        date: event.date,
                                        venue: event.venue,
                                        ticketTypes: event.ticketTypes
                                          ? {
                                              Free: {
                                                enabled:
                                                  event.ticketTypes.Free
                                                    ?.enabled ?? true,
                                                price: 0,
                                              },
                                              Standard: {
                                                enabled:
                                                  event.ticketTypes.Standard
                                                    ?.enabled ?? false,
                                                price:
                                                  event.ticketTypes.Standard?.price?.toString() ??
                                                  '',
                                              },
                                              EarlyBird: {
                                                enabled:
                                                  event.ticketTypes.EarlyBird
                                                    ?.enabled ?? false,
                                                price:
                                                  event.ticketTypes.EarlyBird?.price?.toString() ??
                                                  '',
                                                limit:
                                                  event.ticketTypes.EarlyBird?.limit?.toString() ??
                                                  '',
                                              },
                                              VIP: {
                                                enabled:
                                                  event.ticketTypes.VIP
                                                    ?.enabled ?? false,
                                                price:
                                                  event.ticketTypes.VIP?.price?.toString() ??
                                                  '',
                                              },
                                            }
                                          : {
                                              Free: { enabled: true, price: 0 },
                                              Standard: {
                                                enabled: false,
                                                price: '',
                                              },
                                              EarlyBird: {
                                                enabled: false,
                                                price: '',
                                                limit: '',
                                              },
                                              VIP: {
                                                enabled: false,
                                                price: '',
                                              },
                                            },
                                        category: event.category || 'Concert',
                                        isDraft: event.isDraft ?? true,
                                        seatingEnabled:
                                          (event.seatingLayout &&
                                            event.seatingLayout.length > 0) ??
                                          false,
                                        totalSeats: event.totalSeats || '',
                                        sections: event.seatingLayout || [],
                                      });
                                      // Switch to create tab to show the form
                                      setActiveTab('create');
                                    }}
                                    className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition font-medium"
                                    title="Edit event"
                                  >
                                    Edit
                                  </button>
                                  <Link
                                    href={`/event/${event._id}`}
                                    className="text-xs px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded transition font-medium"
                                    title="Preview event"
                                  >
                                    Preview
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteEvent(event._id)}
                                    className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded transition font-medium"
                                    title="Delete event"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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
              <div className="space-y-4 md:space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-stone-900">
                      Tickets
                    </h2>
                    <p className="text-sm md:text-base text-stone-600">
                      View all sold tickets and their status
                    </p>
                  </div>

                  <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                    <button
                      onClick={() => fetchAllTickets()}
                      className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-medium text-sm whitespace-nowrap"
                      title="Refresh tickets list"
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
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Refresh
                    </button>
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
                          <th className="px-6 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                            Delete
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
                                {ticket.seats
                                  ?.map((s) => s.seatId)
                                  .join(', ') || 'N/A'}
                              </td>
                              <td className="px-6 py-4">
                                {getStatusBadge(ticket.status || 'valid')}
                              </td>
                              <td className="px-6 py-4">
                                <Link
                                  href={`/admin/tickets/${ticket._id}`}
                                  className="text-amber-600 hover:text-amber-800 transition text-sm font-medium"
                                >
                                  View Ticket
                                </Link>
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => handleDeleteTicket(ticket._id)}
                                  className="text-red-600 hover:text-red-800 transition text-sm font-medium"
                                >
                                  Delete
                                </button>
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
                <div className="mb-4 md:mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-stone-900">
                    QR Code Scanner
                  </h2>
                  <p className="text-sm md:text-base text-stone-600">
                    Scan tickets for real-time entry validation
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200 p-8">
                  {/* Camera Scanner Button */}
                  <div className="text-center mb-8">
                    <button
                      onClick={openCameraScanner}
                      disabled={scanning}
                      className="inline-flex items-center gap-3 bg-amber-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {scanning ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Scanning...</span>
                        </>
                      ) : (
                        <>
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
                              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span>Open Camera Scanner</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Camera Modal */}
                  {showCameraModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                      <div className="bg-white rounded-2xl w-full max-w-lg mx-4">
                        <div className="flex items-center justify-between p-6 border-b border-stone-200">
                          <h3 className="text-lg font-bold text-stone-900">
                            Scan QR Code
                          </h3>
                          <button
                            onClick={closeCameraScanner}
                            className="text-stone-400 hover:text-stone-600 transition"
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                        <div className="p-6">
                          <div
                            id="qr-reader"
                            style={{ width: '100%' }}
                          ></div>
                          <p className="text-sm text-stone-500 mt-4 text-center">
                            Position the QR code in front of your camera
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

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
                              scanResult.success
                                ? 'text-green-800'
                                : 'text-red-800'
                            }`}
                          >
                            {scanResult.success
                              ? 'Entry Granted!'
                              : 'Entry Denied'}
                          </h3>
                          <p
                            className={
                              scanResult.success
                                ? 'text-green-700'
                                : 'text-red-700'
                            }
                          >
                            {scanResult.message}
                          </p>

                          {scanResult.ticket && (
                            <div className="mt-4 p-4 bg-white rounded-xl">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-stone-500">
                                    Ticket Number
                                  </p>
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
                                    {scanResult.ticket.seats
                                      ?.map((s) => s.seatId)
                                      .join(', ') || 'N/A'}
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
                          Click &quot;Open Camera Scanner&quot; to activate your camera
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                          2
                        </span>
                        <span>
                          Grant camera permission when your browser asks
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                          3
                        </span>
                        <span>
                          Point the camera at the attendee&apos;s QR code (phone or printed)
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                          4
                        </span>
                        <span>
                          The scanner automatically detects and validates the ticket instantly
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                          5
                        </span>
                        <span>
                          If valid, the ticket is marked as &quot;Used&quot; and entry is granted
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
                <div className="mb-4 md:mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-stone-900">
                    {editingEventId ? 'Edit Event' : 'Create New Event'}
                  </h2>
                  <p className="text-sm md:text-base text-stone-600">
                    {editingEventId
                      ? 'Update event details (seating configuration is locked)'
                      : 'Fill in the details to create a new event'}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200 p-4 md:p-8">
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
                        Short Description
                      </label>
                      <textarea
                        value={newEvent.description}
                        onChange={(e) =>
                          setNewEvent({
                            ...newEvent,
                            description: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                        rows={3}
                        placeholder="Brief description for event listing"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-stone-700 mb-2">
                        Long Description
                      </label>
                      <textarea
                        value={newEvent.longDescription}
                        onChange={(e) =>
                          setNewEvent({
                            ...newEvent,
                            longDescription: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                        rows={6}
                        placeholder="Detailed description for event details page"
                      />
                      <p className="mt-1 text-xs text-stone-500">
                        This will be displayed on the event details page
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-stone-700 mb-2">
                        Cover Image
                      </label>
                      <div className="space-y-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setNewEvent({
                                ...newEvent,
                                coverImageFile: file,
                              });
                              try {
                                setLoading(true);
                                const { uploadImage } = await import(
                                  '@/lib/api'
                                );
                                const uploadResult = await uploadImage(file);
                                setNewEvent((prev) => ({
                                  ...prev,
                                  coverImage: uploadResult.secure_url,
                                  coverImagePublicId: uploadResult.public_id,
                                }));
                                toast.success(
                                  'Cover image uploaded successfully!'
                                );
                              } catch (err) {
                                toast.error(
                                  'Failed to upload cover image. Check Cloudinary configuration.'
                                );
                                console.error(err);
                              } finally {
                                setLoading(false);
                              }
                            }
                          }}
                          className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                        />
                        {newEvent.coverImage && (
                          <div className="relative w-full h-48 bg-stone-100 rounded-xl overflow-hidden">
                            <img
                              src={newEvent.coverImage}
                              alt="Cover preview"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  // Delete from Cloudinary if public_id exists
                                  if (newEvent.coverImagePublicId) {
                                    setLoading(true);
                                    const { eventsAPI } = await import(
                                      '@/lib/api'
                                    );
                                    await eventsAPI.deleteImage(
                                      newEvent.coverImagePublicId
                                    );
                                  }
                                  // Clear the image fields
                                  setNewEvent({
                                    ...newEvent,
                                    coverImage: '',
                                    coverImagePublicId: '',
                                    coverImageFile: null,
                                  });
                                  toast.success('Image removed');
                                } catch (err) {
                                  console.error('Error deleting image:', err);
                                  // Still clear the image field even if delete fails
                                  setNewEvent({
                                    ...newEvent,
                                    coverImage: '',
                                    coverImagePublicId: '',
                                    coverImageFile: null,
                                  });
                                  toast.success('Image removed');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition disabled:opacity-50"
                              disabled={loading}
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
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
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
                    {/* Ticket Types Section */}
                    <div className="border-t border-stone-200 pt-6">
                      <h3 className="text-lg font-semibold text-stone-900 mb-4">
                        Ticket Types
                      </h3>
                      <p className="text-sm text-stone-600 mb-4">
                        Select which ticket types are available for this event.
                        Customers will only see the types you enable.
                      </p>

                      {/* Free Ticket Type */}
                      <div className="mb-6 p-4 border border-stone-200 rounded-lg bg-stone-50">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newEvent.ticketTypes.Free.enabled}
                              onChange={(e) =>
                                setNewEvent({
                                  ...newEvent,
                                  ticketTypes: {
                                    ...newEvent.ticketTypes,
                                    Free: {
                                      ...newEvent.ticketTypes.Free,
                                      enabled: e.target.checked,
                                    },
                                  },
                                })
                              }
                              className="w-5 h-5 rounded border-stone-300 cursor-pointer"
                            />
                            <span className="font-semibold text-stone-900">
                              Free
                            </span>
                          </label>
                          <span className="text-sm text-stone-600">
                            (Always $0 - no price input needed)
                          </span>
                        </div>
                      </div>

                      {/* Standard Ticket Type */}
                      <div className="mb-6 p-4 border border-stone-200 rounded-lg">
                        <div className="flex items-center gap-4 mb-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newEvent.ticketTypes.Standard.enabled}
                              onChange={(e) =>
                                setNewEvent({
                                  ...newEvent,
                                  ticketTypes: {
                                    ...newEvent.ticketTypes,
                                    Standard: {
                                      ...newEvent.ticketTypes.Standard,
                                      enabled: e.target.checked,
                                    },
                                  },
                                })
                              }
                              className="w-5 h-5 rounded border-stone-300 cursor-pointer"
                            />
                            <span className="font-semibold text-stone-900">
                              Standard
                            </span>
                          </label>
                        </div>
                        {newEvent.ticketTypes.Standard.enabled && (
                          <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">
                              Price ($)
                            </label>
                            <input
                              type="number"
                              value={newEvent.ticketTypes.Standard.price}
                              onChange={(e) =>
                                setNewEvent({
                                  ...newEvent,
                                  ticketTypes: {
                                    ...newEvent.ticketTypes,
                                    Standard: {
                                      ...newEvent.ticketTypes.Standard,
                                      price: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                              placeholder="e.g., 29.99"
                              step="0.01"
                              min="0"
                            />
                          </div>
                        )}
                      </div>

                      {/* Early Bird Ticket Type */}
                      <div className="mb-6 p-4 border border-stone-200 rounded-lg">
                        <div className="flex items-center gap-4 mb-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newEvent.ticketTypes.EarlyBird.enabled}
                              onChange={(e) =>
                                setNewEvent({
                                  ...newEvent,
                                  ticketTypes: {
                                    ...newEvent.ticketTypes,
                                    EarlyBird: {
                                      ...newEvent.ticketTypes.EarlyBird,
                                      enabled: e.target.checked,
                                    },
                                  },
                                })
                              }
                              className="w-5 h-5 rounded border-stone-300 cursor-pointer"
                            />
                            <span className="font-semibold text-stone-900">
                              Early Bird
                            </span>
                          </label>
                        </div>
                        {newEvent.ticketTypes.EarlyBird.enabled && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-stone-700 mb-2">
                                Price ($)
                              </label>
                              <input
                                type="number"
                                value={newEvent.ticketTypes.EarlyBird.price}
                                onChange={(e) =>
                                  setNewEvent({
                                    ...newEvent,
                                    ticketTypes: {
                                      ...newEvent.ticketTypes,
                                      EarlyBird: {
                                        ...newEvent.ticketTypes.EarlyBird,
                                        price: e.target.value,
                                      },
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                                placeholder="e.g., 19.99"
                                step="0.01"
                                min="0"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-stone-700 mb-2">
                                Ticket Limit (max tickets to sell)
                              </label>
                              <input
                                type="number"
                                value={newEvent.ticketTypes.EarlyBird.limit}
                                onChange={(e) =>
                                  setNewEvent({
                                    ...newEvent,
                                    ticketTypes: {
                                      ...newEvent.ticketTypes,
                                      EarlyBird: {
                                        ...newEvent.ticketTypes.EarlyBird,
                                        limit: e.target.value,
                                      },
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                                placeholder="e.g., 50"
                                min="1"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* VIP Ticket Type */}
                      <div className="mb-6 p-4 border border-stone-200 rounded-lg">
                        <div className="flex items-center gap-4 mb-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newEvent.ticketTypes.VIP.enabled}
                              onChange={(e) =>
                                setNewEvent({
                                  ...newEvent,
                                  ticketTypes: {
                                    ...newEvent.ticketTypes,
                                    VIP: {
                                      ...newEvent.ticketTypes.VIP,
                                      enabled: e.target.checked,
                                    },
                                  },
                                })
                              }
                              className="w-5 h-5 rounded border-stone-300 cursor-pointer"
                            />
                            <span className="font-semibold text-stone-900">
                              VIP
                            </span>
                          </label>
                        </div>
                        {newEvent.ticketTypes.VIP.enabled && (
                          <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">
                              Price ($)
                            </label>
                            <input
                              type="number"
                              value={newEvent.ticketTypes.VIP.price}
                              onChange={(e) =>
                                setNewEvent({
                                  ...newEvent,
                                  ticketTypes: {
                                    ...newEvent.ticketTypes,
                                    VIP: {
                                      ...newEvent.ticketTypes.VIP,
                                      price: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                              placeholder="e.g., 49.99"
                              step="0.01"
                              min="0"
                            />
                          </div>
                        )}
                      </div>
                    </div>{' '}
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
                    <div>
                      <label className="block text-sm font-semibold text-stone-700 mb-2">
                        Category
                      </label>
                      <select
                        value={newEvent.category}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, category: e.target.value })
                        }
                        className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                        required
                      >
                        <option value="Movies">🎬 Movies</option>
                        <option value="Theatre">🎭 Theatre</option>
                        <option value="Concert">🎵 Concert</option>
                        <option value="Sahra">🌙 Sahra</option>
                      </select>
                    </div>
                    {/* Visual Seating Configuration */}
                    <div className="border-t border-stone-200 pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-stone-900">
                            Visual Seat Selection
                          </h3>
                          <p className="text-sm text-stone-600">
                            Enable interactive seat map for customers
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newEvent.seatingEnabled}
                            onChange={(e) =>
                              setNewEvent({
                                ...newEvent,
                                seatingEnabled: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {newEvent.seatingEnabled && (
                        <div className="space-y-4 mt-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-stone-600">
                              Configure sections and preview the seating layout
                            </p>
                            <button
                              type="button"
                              onClick={addSection}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition flex items-center gap-2"
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
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                              Add Section
                            </button>
                          </div>

                          {newEvent.sections.map((section, index) => (
                            <div
                              key={section.id}
                              className="border border-stone-200 rounded-xl p-4 bg-stone-50"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <input
                                  type="text"
                                  value={section.name}
                                  onChange={(e) =>
                                    updateSection(section.id, {
                                      name: e.target.value,
                                    })
                                  }
                                  className="text-lg font-bold text-stone-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-amber-500 rounded px-2"
                                  placeholder="Section name"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSection(section.id)}
                                  className="text-red-500 hover:text-red-700 transition"
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
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                                    Columns
                                  </label>
                                  <input
                                    type="number"
                                    value={section.columns}
                                    onChange={(e) =>
                                      updateSection(section.id, {
                                        columns: parseInt(e.target.value) || 1,
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                                    min="1"
                                    max="26"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                                    Rows
                                  </label>
                                  <input
                                    type="number"
                                    value={section.rows}
                                    onChange={(e) =>
                                      updateSection(section.id, {
                                        rows: parseInt(e.target.value) || 1,
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                                    min="1"
                                    max="50"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                                    Price +/-
                                  </label>
                                  <input
                                    type="number"
                                    value={section.priceModifier}
                                    onChange={(e) =>
                                      updateSection(section.id, {
                                        priceModifier:
                                          parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                                    step="0.01"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                                    Orientation
                                  </label>
                                  <select
                                    value={section.orientation}
                                    onChange={(e) =>
                                      updateSection(section.id, {
                                        orientation: e.target.value as
                                          | 'vertical'
                                          | 'horizontal',
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                                  >
                                    <option value="horizontal">
                                      Horizontal
                                    </option>
                                    <option value="vertical">Vertical</option>
                                  </select>
                                </div>
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={section.accessibility}
                                    onChange={(e) =>
                                      updateSection(section.id, {
                                        accessibility: e.target.checked,
                                      })
                                    }
                                    className="w-4 h-4 text-amber-600 bg-stone-100 border-stone-300 rounded focus:ring-amber-500"
                                  />
                                  <span>Accessible seating section</span>
                                </label>
                              </div>

                              {/* Mini preview */}
                              <div className="mt-3 p-3 bg-white rounded-lg border border-stone-200">
                                <div className="text-xs text-stone-600 mb-2">
                                  Preview: {section.columns} × {section.rows} ={' '}
                                  {section.columns * section.rows} seats
                                </div>
                                <div
                                  className="grid gap-0.5"
                                  style={{
                                    gridTemplateColumns:
                                      section.orientation === 'horizontal'
                                        ? `repeat(${Math.min(
                                            section.columns,
                                            15
                                          )}, minmax(0, 1fr))`
                                        : `repeat(${Math.min(
                                            section.rows,
                                            15
                                          )}, minmax(0, 1fr))`,
                                  }}
                                >
                                  {Array.from({
                                    length: Math.min(
                                      section.columns * section.rows,
                                      150
                                    ),
                                  }).map((_, i) => (
                                    <div
                                      key={i}
                                      className="w-3 h-3 bg-green-500 rounded-sm"
                                      title="Available seat"
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}

                          {newEvent.sections.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                              <div className="flex items-center gap-2 text-amber-800">
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
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <span className="font-semibold">
                                  Total calculated seats:{' '}
                                  {calculateTotalSeatsFromSections()}
                                </span>
                              </div>
                              <p className="text-sm text-amber-700 mt-1">
                                This will override the "Total Seats" field above
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Manual Total Seats for Standing Room Events */}
                    {!newEvent.seatingEnabled && (
                      <div className="border-t border-stone-200 pt-6">
                        <div>
                          <label className="block text-sm font-semibold text-stone-700 mb-2">
                            Total Event Capacity
                          </label>
                          <p className="text-xs text-stone-500 mb-3">
                            Set the total number of available spots (e.g., for
                            standing room, raves, or general admission events)
                          </p>
                          <input
                            type="number"
                            min="1"
                            value={newEvent.totalSeats}
                            onChange={(e) =>
                              setNewEvent({
                                ...newEvent,
                                totalSeats: e.target.value
                                  ? parseInt(e.target.value)
                                  : '',
                              })
                            }
                            placeholder="e.g., 500"
                            className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
                          />
                          <p className="text-xs text-stone-500 mt-2">
                            Seats will be automatically assigned as generic
                            passes when customers purchase tickets
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="border-t border-stone-200 pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-stone-900">
                            Save as Draft
                          </h3>
                          <p className="text-sm text-stone-600">
                            {newEvent.isDraft
                              ? 'Event will be hidden until published'
                              : 'Event will be published immediately'}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newEvent.isDraft}
                            onChange={(e) =>
                              setNewEvent({
                                ...newEvent,
                                isDraft: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowPreview(true)}
                        disabled={!newEvent.name || !newEvent.description}
                        className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-900 py-4 rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
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
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        Preview
                      </button>
                      {editingEventId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEventId(null);
                            setNewEvent({
                              name: '',
                              description: '',
                              longDescription: '',
                              coverImage: '',
                              coverImagePublicId: '',
                              coverImageFile: null,
                              date: '',
                              venue: '',
                              ticketTypes: {
                                Free: { enabled: true, price: 0 },
                                Standard: { enabled: false, price: '' },
                                EarlyBird: {
                                  enabled: false,
                                  price: '',
                                  limit: '',
                                },
                                VIP: { enabled: false, price: '' },
                              },
                              category: 'Concert',
                              isDraft: true,
                              seatingEnabled: false,
                              totalSeats: '',
                              sections: [],
                            });
                            setActiveTab('events');
                          }}
                          className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 py-3 md:py-4 rounded-xl font-semibold transition text-sm md:text-base"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={loading || creatingEvent}
                        className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white py-3 md:py-4 rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base"
                      >
                        {loading || creatingEvent ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            {editingEventId ? 'Saving...' : 'Creating...'}
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
                            {editingEventId ? 'Save Changes' : 'Create Event'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Preview Modal */}
                {showPreview && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      {/* Modal Header */}
                      <div className="sticky top-0 bg-white border-b border-stone-200 p-6 flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-stone-900">
                          Event Preview
                        </h3>
                        <button
                          onClick={() => setShowPreview(false)}
                          className="text-stone-500 hover:text-stone-900 transition"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Modal Content */}
                      <div className="p-6 space-y-6">
                        {/* Cover Image */}
                        {newEvent.coverImage && (
                          <div className="relative w-full h-64 bg-stone-200 rounded-xl overflow-hidden">
                            <img
                              src={newEvent.coverImage}
                              alt={newEvent.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Event Title */}
                        <div>
                          <h1 className="text-4xl font-bold text-stone-900 mb-2">
                            {newEvent.name || 'Event Name'}
                          </h1>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
                              {newEvent.category}
                            </span>
                            {newEvent.isDraft && (
                              <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                                Draft
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Short Description */}
                        <div>
                          <h2 className="text-lg font-semibold text-stone-900 mb-2">
                            About This Event
                          </h2>
                          <p className="text-stone-700 leading-relaxed">
                            {newEvent.description || 'No description provided'}
                          </p>
                        </div>

                        {/* Long Description */}
                        {newEvent.longDescription && (
                          <div>
                            <h2 className="text-lg font-semibold text-stone-900 mb-2">
                              Event Details
                            </h2>
                            <p className="text-stone-700 leading-relaxed whitespace-pre-wrap">
                              {newEvent.longDescription}
                            </p>
                          </div>
                        )}

                        {/* Event Information Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Date & Time */}
                          <div className="bg-stone-50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-stone-700 mb-1">
                              Date & Time
                            </h3>
                            <p className="text-stone-900">
                              {newEvent.date
                                ? new Date(newEvent.date).toLocaleString()
                                : 'Date not set'}
                            </p>
                          </div>

                          {/* Venue */}
                          <div className="bg-stone-50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-stone-700 mb-1">
                              Venue
                            </h3>
                            <p className="text-stone-900">
                              {newEvent.venue || 'Venue not set'}
                            </p>
                          </div>

                          {/* Ticket Types */}
                          <div className="bg-stone-50 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-stone-700 mb-2">
                              Available Ticket Types
                            </h3>
                            <div className="space-y-1 text-sm">
                              {Object.entries(newEvent.ticketTypes).map(
                                ([type, config]) =>
                                  config.enabled && (
                                    <p key={type} className="text-stone-700">
                                      <span className="font-medium">
                                        {type}:
                                      </span>{' '}
                                      <span className="text-amber-600">
                                        $
                                        {(config.price as string | number)
                                          ? (typeof config.price === 'string'
                                              ? parseFloat(config.price)
                                              : config.price
                                            ).toFixed(2)
                                          : '0.00'}
                                      </span>
                                      {type === 'EarlyBird' &&
                                        'limit' in config &&
                                        (config as any).limit && (
                                          <span className="text-stone-500 text-xs ml-2">
                                            (limit:{' '}
                                            {
                                              (config as any).limit as
                                                | string
                                                | number
                                            }
                                            )
                                          </span>
                                        )}
                                    </p>
                                  )
                              )}
                              {!Object.values(newEvent.ticketTypes).some(
                                (t) => t.enabled
                              ) && (
                                <p className="text-stone-500 italic">
                                  No ticket types enabled
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Seating Info */}
                          {newEvent.seatingEnabled &&
                            newEvent.sections.length > 0 && (
                              <div className="bg-stone-50 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-stone-700 mb-1">
                                  Total Seats
                                </h3>
                                <p className="text-2xl font-bold text-stone-900">
                                  {calculateTotalSeatsFromSections()}
                                </p>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}{' '}
          </div>
        </main>
      </div>
    </div>
  );
}
