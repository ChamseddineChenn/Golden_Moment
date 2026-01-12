'use client';

import { useState } from 'react';
import TicketForm from './TicketForm';

interface Event {
  _id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  totalSeats: number;
  soldTickets: number;
}

interface EventsListProps {
  events: Event[];
  onEventsUpdated: () => void;
}

export default function EventsList({
  events,
  onEventsUpdated,
}: EventsListProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No events created yet. Create one using the form on the left.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {events.map((event) => (
        <div
          key={event._id}
          className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">{event.name}</h3>
              <p className="text-gray-600 text-sm mt-1">{event.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Venue:</span>
              <p className="text-gray-600">{event.venue}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Date:</span>
              <p className="text-gray-600">
                {new Date(event.date).toLocaleString('en-US')}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Total Seats:</span>
              <p className="text-gray-600">{event.totalSeats}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Sold:</span>
              <p className="text-gray-600">
                {event.soldTickets} / {event.totalSeats}
              </p>
            </div>
          </div>

          {/* Create Ticket Form */}
          <div className="bg-gray-50 rounded p-4">
            <button
              onClick={() =>
                setSelectedEventId(
                  selectedEventId === event._id ? null : event._id
                )
              }
              className="text-blue-600 font-medium hover:text-blue-700 mb-3"
            >
              {selectedEventId === event._id ? '- Close' : '+ Create Ticket'}
            </button>
            {selectedEventId === event._id && (
              <TicketForm
                eventId={event._id}
                onSuccess={() => {
                  onEventsUpdated();
                  setSelectedEventId(null);
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
