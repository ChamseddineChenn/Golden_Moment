'use client';

import { useState } from 'react';
import { ticketsAPI } from '@/lib/api';

interface TicketFormProps {
  eventId: string;
  onSuccess: () => void;
}

export default function TicketForm({ eventId, onSuccess }: TicketFormProps) {
  const [formData, setFormData] = useState({
    ticketNumber: '',
    seatNumber: '',
    buyerName: '',
    buyerEmail: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const ticketData = {
        eventId,
        ...formData,
      };

      await ticketsAPI.create(ticketData);

      setSuccess(true);
      setFormData({
        ticketNumber: '',
        seatNumber: '',
        buyerName: '',
        buyerEmail: '',
      });

      setTimeout(() => setSuccess(false), 3000);
      onSuccess();
    } catch (err) {
      setError('Failed to create ticket. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm">
          Ticket created successfully!
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Ticket #
          </label>
          <input
            type="text"
            name="ticketNumber"
            value={formData.ticketNumber}
            onChange={handleChange}
            required
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="TK001"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Seat
          </label>
          <input
            type="text"
            name="seatNumber"
            value={formData.seatNumber}
            onChange={handleChange}
            required
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="A1"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Buyer Name
        </label>
        <input
          type="text"
          name="buyerName"
          value={formData.buyerName}
          onChange={handleChange}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="John Doe"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Buyer Email
        </label>
        <input
          type="email"
          name="buyerEmail"
          value={formData.buyerEmail}
          onChange={handleChange}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="john@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white py-1 rounded font-medium text-sm hover:bg-green-700 disabled:bg-gray-400 transition-colors"
      >
        {loading ? 'Creating...' : 'Create Ticket'}
      </button>
    </form>
  );
}
