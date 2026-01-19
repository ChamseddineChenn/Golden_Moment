'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ticketsAPI } from '@/lib/api';
import Link from 'next/link';
import jsPDF from 'jspdf';

interface Ticket {
  _id: string;
  ticketNumber: string;
  eventId:
    | {
        _id: string;
        name: string;
        description: string;
        date: string;
        venue: string;
      }
    | string;
  seats: Array<{ sectionId?: string; seatId: string }>;
  buyerName: string;
  buyerEmail: string;
  buyerPhoneNumber: string;
  purchaseDate: string;
  qrCode: string;
}

export default function ReceiptPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const response = await ticketsAPI.getById(ticketId);
        // Extract data from standardized response format { success, statusCode, data, timestamp }
        const ticketData = response.data.data || response.data;
        setTicket(ticketData);
      } catch (err) {
        setError('Failed to load ticket');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  const handleDownloadPDF = async () => {
    if (!ticket) return;

    setDownloading(true);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();

      const eventInfo =
        typeof ticket.eventId === 'object' ? ticket.eventId : null;
      const eventDate = eventInfo ? new Date(eventInfo.date) : new Date();

      // Header
      pdf.setFillColor(41, 37, 36);
      pdf.rect(0, 0, pageWidth, 60, 'F');

      // Logo
      pdf.setFillColor(245, 158, 11);
      pdf.roundedRect(20, 15, 16, 16, 3, 3, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('G', 25, 26);

      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Golden Moment Events', 42, 22);

      pdf.setFontSize(10);
      pdf.setTextColor(168, 162, 158);
      pdf.text('E-Ticket / Entry Pass', 42, 30);

      // Ticket number
      pdf.setFillColor(245, 158, 11);
      pdf.roundedRect(pageWidth - 55, 18, 40, 12, 2, 2, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(ticket.ticketNumber, pageWidth - 35, 26, { align: 'center' });

      // Event title
      pdf.setTextColor(41, 37, 36);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      const eventName = eventInfo?.name || 'Event';
      pdf.text(eventName, 20, 80);

      // Main Section - Split vertically (1:3 ratio - seats : date/reserved)
      const pageMargins = 20;
      const availableWidth = pageWidth - pageMargins * 2 - 5; // 5mm gap
      const seatSectionWidth = availableWidth / 4; // 1 part for seats
      const dateReservedWidth = (availableWidth * 3) / 4; // 3 parts for date & reserved
      const seatSectionStartX = pageMargins;
      const dateReservedStartX = seatSectionStartX + seatSectionWidth + 5; // 5mm gap
      const sectionHeight = 95;
      const sectionMargin = 3;
      const sectionY = 90;

      // LEFT SECTION - Seats (narrower)
      pdf.setFillColor(254, 243, 224); // from-amber-50
      pdf.roundedRect(
        seatSectionStartX,
        sectionY,
        seatSectionWidth,
        sectionHeight,
        3,
        3,
        'F',
      );

      pdf.setFontSize(8);
      pdf.setTextColor(180, 83, 9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(
        `SEATS (${ticket.seats.length})`,
        seatSectionStartX + seatSectionWidth / 2,
        sectionY + 8,
        { align: 'center' },
      );

      // Format seat numbers - max 10, with wrapping
      const seatIds = ticket.seats.map((s) => s.seatId);
      const seatsPerLine = 2; // Max 2 seats per line for narrow width
      pdf.setFontSize(12);
      pdf.setTextColor(120, 53, 15); // text-amber-900
      pdf.setFont('helvetica', 'bold');

      let seatY = sectionY + 20;
      for (let i = 0; i < Math.min(seatIds.length, 10); i += seatsPerLine) {
        const seatLine = seatIds.slice(i, i + seatsPerLine).join(', ');
        pdf.text(seatLine, seatSectionStartX + seatSectionWidth / 2, seatY, {
          align: 'center',
        });
        seatY += 9;
      }

      // RIGHT SECTION - Date & Time (Top) + Reserved By (Bottom) stacked
      // Top: Date, Time, Venue
      pdf.setFillColor(250, 250, 249); // stone-50
      pdf.roundedRect(
        dateReservedStartX,
        sectionY,
        dateReservedWidth,
        (sectionHeight - sectionMargin) / 2,
        3,
        3,
        'F',
      );

      pdf.setFontSize(7);
      pdf.setTextColor(120, 113, 108);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DATE & TIME', dateReservedStartX + 8, sectionY + 8);

      pdf.setFontSize(9);
      pdf.setTextColor(41, 37, 36);
      pdf.setFont('helvetica', 'bold');
      const dateStr = eventDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const timeStr = eventDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      pdf.text(dateStr, dateReservedStartX + 8, sectionY + 16);
      pdf.text(timeStr, dateReservedStartX + 8, sectionY + 23);

      pdf.setFontSize(7);
      pdf.setTextColor(120, 113, 108);
      pdf.setFont('helvetica', 'bold');
      pdf.text('VENUE', dateReservedStartX + 8, sectionY + 31);
      pdf.setFontSize(8);
      pdf.setTextColor(41, 37, 36);
      pdf.setFont('helvetica', 'normal');
      const venueLines = pdf.splitTextToSize(
        eventInfo?.venue || 'TBA',
        dateReservedWidth - 16,
      );
      pdf.text(venueLines, dateReservedStartX + 8, sectionY + 38);

      // Bottom: Reserved by (Name, Email, Phone)
      pdf.setFillColor(245, 245, 244); // stone-50
      pdf.roundedRect(
        dateReservedStartX,
        sectionY + (sectionHeight - sectionMargin) / 2 + sectionMargin,
        dateReservedWidth,
        (sectionHeight - sectionMargin) / 2,
        3,
        3,
        'F',
      );

      let bottomY =
        sectionY + (sectionHeight - sectionMargin) / 2 + sectionMargin + 8;
      pdf.setFontSize(7);
      pdf.setTextColor(120, 113, 108);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RESERVED BY', dateReservedStartX + 8, bottomY);

      bottomY += 7;
      pdf.setFontSize(9);
      pdf.setTextColor(41, 37, 36);
      pdf.setFont('helvetica', 'bold');
      const nameLines = pdf.splitTextToSize(
        ticket.buyerName,
        dateReservedWidth - 16,
      );
      pdf.text(nameLines, dateReservedStartX + 8, bottomY);
      bottomY += nameLines.length * 5 + 2;

      pdf.setFontSize(7);
      pdf.setTextColor(120, 113, 108);
      pdf.setFont('helvetica', 'bold');
      pdf.text('EMAIL', dateReservedStartX + 8, bottomY);
      bottomY += 5;
      pdf.setFontSize(7);
      pdf.setTextColor(87, 83, 82);
      pdf.setFont('helvetica', 'normal');
      const emailLines = pdf.splitTextToSize(
        ticket.buyerEmail,
        dateReservedWidth - 16,
      );
      pdf.text(emailLines, dateReservedStartX + 8, bottomY);
      bottomY += emailLines.length * 4 + 2;

      pdf.setFontSize(7);
      pdf.setTextColor(120, 113, 108);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PHONE', dateReservedStartX + 8, bottomY);
      bottomY += 5;
      pdf.setFontSize(7);
      pdf.setTextColor(87, 83, 82);
      pdf.setFont('helvetica', 'normal');
      const phoneLines = pdf.splitTextToSize(
        ticket.buyerPhoneNumber,
        dateReservedWidth - 16,
      );
      pdf.text(phoneLines, dateReservedStartX + 8, bottomY);

      // QR Section (Dark Stone) - with margin from main section
      const qrMargin = 5;
      const qrY = sectionY + sectionHeight + qrMargin;
      pdf.setFillColor(28, 25, 23); // from-stone-800
      pdf.roundedRect(20, qrY, pageWidth - 40, 70, 3, 3, 'F');

      pdf.setFontSize(10);
      pdf.setTextColor(168, 162, 158); // text-stone-400
      pdf.setFont('helvetica', 'bold');
      pdf.text('SCAN QR CODE FOR ENTRY', pageWidth / 2, qrY + 15, {
        align: 'center',
      });

      if (ticket.qrCode) {
        try {
          const qrSize = 40;
          const qrX = (pageWidth - qrSize) / 2;
          // White background for QR
          pdf.setFillColor(255, 255, 255);
          pdf.rect(qrX - 2, qrY + 20 - 2, qrSize + 4, qrSize + 4, 'F');
          pdf.addImage(ticket.qrCode, 'PNG', qrX, qrY + 20, qrSize, qrSize);
        } catch (qrError) {
          console.error('Error adding QR code:', qrError);
        }
      }

      pdf.setFontSize(8);
      pdf.setTextColor(120, 113, 108);
      pdf.text(
        'Present this QR code at the venue entrance',
        pageWidth / 2,
        qrY + 65,
        { align: 'center' },
      );

      // Purchase date
      const purchaseDate = new Date(ticket.purchaseDate);
      pdf.setFontSize(8);
      pdf.setTextColor(120, 113, 108);
      pdf.text(
        `Purchased on ${purchaseDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        pageWidth / 2,
        265,
        { align: 'center' },
      );

      // Footer (Dark Stone) - extends to bottom of page
      pdf.setFillColor(28, 25, 23); // stone-900
      pdf.rect(0, 285, pageWidth, 12, 'F');

      pdf.setFontSize(8);
      pdf.setTextColor(168, 162, 158);
      pdf.text(
        'Golden Moment Events • www.goldenmoment.tn • support@goldenmoment.tn',
        pageWidth / 2,
        290.5,
        { align: 'center' },
      );

      pdf.save(`ticket-${ticket.ticketNumber}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-stone-600 mt-4">Loading your ticket...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md shadow-lg border border-stone-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
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
          <h1 className="text-2xl font-bold text-stone-900 mb-2">
            Ticket Not Found
          </h1>
          <p className="text-stone-600 mb-6">
            {error || "We couldn't find the ticket you're looking for."}
          </p>
          <Link
            href="/"
            className="inline-block bg-stone-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-stone-800 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const eventInfo = typeof ticket.eventId === 'object' ? ticket.eventId : null;
  const eventDate = eventInfo ? new Date(eventInfo.date) : new Date();
  const purchaseDate = new Date(ticket.purchaseDate);

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <span className="text-white text-lg font-bold">G</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-stone-900">
                  Golden Moment
                </h1>
                <p className="text-xs text-stone-500 -mt-0.5">
                  Events & Experiences
                </p>
              </div>
            </Link>

            <Link
              href="/"
              className="text-stone-600 hover:text-stone-900 transition flex items-center gap-2"
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
        </div>
      </header>

      {/* Success Message */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="text-left">
              <h2 className="text-xl font-bold">Booking Confirmed!</h2>
              <p className="text-green-100 text-sm">
                Your e-ticket has been sent to your email
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-4 rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Generating PDF...
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
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download PDF Ticket
              </>
            )}
          </button>

          <button className="flex-1 bg-white text-stone-700 px-6 py-4 rounded-xl font-semibold border border-stone-200 hover:bg-stone-50 transition flex items-center justify-center gap-3">
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
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share Ticket
          </button>
        </div>

        {/* Ticket Card */}
        <div
          ref={receiptRef}
          id="receipt-content"
          className="bg-white rounded-3xl overflow-hidden shadow-xl border border-stone-200"
        >
          {/* Ticket Header */}
          <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white p-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                  <span className="text-xl font-bold">G</span>
                </div>
                <div>
                  <p className="font-bold text-lg">Golden Moment Events</p>
                  <p className="text-stone-400 text-sm">
                    E-Ticket / Entry Pass
                  </p>
                </div>
              </div>
              <div className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-bold">
                {ticket.ticketNumber}
              </div>
            </div>
          </div>

          {/* Event Info */}
          <div className="p-8">
            <h2 className="text-3xl font-bold text-stone-900 mb-6">
              {eventInfo?.name || 'Event'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-stone-50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
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
                  </div>
                  <p className="text-sm text-stone-500 font-medium">
                    DATE & TIME
                  </p>
                </div>
                <p className="text-lg font-bold text-stone-900">
                  {eventDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-stone-600">
                  {eventDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <div className="bg-stone-50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
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
                  <p className="text-sm text-stone-500 font-medium">VENUE</p>
                </div>
                <p className="text-lg font-bold text-stone-900">
                  {eventInfo?.venue || 'TBA'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl p-6 border border-amber-200">
                <p className="text-sm text-amber-700 font-medium mb-2">
                  SEATS ({ticket.seats.length})
                </p>
                <div className="space-y-2">
                  {ticket.seats.map((seat, idx) => (
                    <p key={idx} className="text-lg font-bold text-amber-900">
                      {seat.seatId}
                    </p>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 bg-stone-50 rounded-2xl p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-stone-500 font-medium mb-1">
                      ATTENDEE NAME
                    </p>
                    <p className="text-lg font-bold text-stone-900">
                      {ticket.buyerName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500 font-medium mb-1">
                      EMAIL
                    </p>
                    <p className="text-stone-700 truncate">
                      {ticket.buyerEmail}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500 font-medium mb-1">
                      PHONE
                    </p>
                    <p className="text-stone-700">{ticket.buyerPhoneNumber}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl p-8 text-center">
              <p className="text-stone-400 text-sm font-medium mb-4">
                SCAN QR CODE FOR ENTRY
              </p>
              {ticket.qrCode && (
                <div className="inline-block bg-white p-4 rounded-2xl shadow-xl">
                  <img
                    src={ticket.qrCode}
                    alt="QR Code"
                    className="w-48 h-48"
                  />
                </div>
              )}
              <p className="text-stone-500 text-xs mt-4">
                Present this QR code at the venue entrance
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-stone-200 text-center">
              <p className="text-stone-500 text-sm">
                Purchased on{' '}
                {purchaseDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="bg-stone-900 text-center py-4">
            <p className="text-stone-400 text-sm">
              Golden Moment Events • www.goldenmoment.tn •
              support@goldenmoment.tn
            </p>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-2xl p-6 border border-stone-200">
          <h3 className="font-bold text-stone-900 mb-4">
            Important Information
          </h3>
          <ul className="space-y-3 text-stone-600 text-sm">
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                Please arrive at least 30 minutes before the event starts
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Have your QR code ready for scanning at the entrance</span>
            </li>
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                This ticket is non-transferable and valid for one entry only
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>For support, contact us at support@goldenmoment.tn</span>
            </li>
          </ul>
        </div>
      </main>

      <footer className="bg-stone-900 text-white mt-12">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <p className="text-stone-400 text-sm">
            © 2026 Golden Moment Events. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
