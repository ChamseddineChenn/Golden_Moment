'use client';

import { useState, useEffect } from 'react';
import { seatsAPI } from '@/lib/api';

interface SeatObject {
  seatId: string;
  row: number;
  column: string;
  status: 'available' | 'reserving' | 'unavailable';
}

interface SeatSection {
  id: string;
  name: string;
  priceModifier?: number;
  seats: SeatObject[];
}

interface SeatMapData {
  event: {
    id: string;
    name: string;
    venue: string;
    date: string;
    basePrice: number;
  };
  seatingLayout: {
    enabled: boolean;
    sections: SeatSection[];
  };
}

interface SelectedSeat {
  sectionId: string;
  seatId: string;
  price: number;
}

interface SeatMapProps {
  eventId: string;
  onSeatsSelected?: (seats: SelectedSeat[], total: number) => void;
}

export default function SeatMap({ eventId, onSeatsSelected }: SeatMapProps) {
  const [seatMapData, setSeatMapData] = useState<SeatMapData | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSeatMap();
    const interval = setInterval(loadSeatMap, 2000); // Refresh every 2 seconds for real-time sync
    return () => clearInterval(interval);
  }, [eventId]);

  useEffect(() => {
    const total = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    onSeatsSelected?.(selectedSeats, total);
  }, [selectedSeats, onSeatsSelected]);

  const loadSeatMap = async () => {
    try {
      const response = await seatsAPI.getSeatMap(eventId);
      setSeatMapData(response.data);
      setLoading(false);
      
      // Log the seat status counts
      const unavailableCount = response.data?.seatingLayout?.sections?.reduce(
        (count, section) =>
          count +
          section.seats.filter((s) => s.status === 'unavailable').length,
        0
      ) || 0;
      const reservingCount = response.data?.seatingLayout?.sections?.reduce(
        (count, section) =>
          count +
          section.seats.filter((s) => s.status === 'reserving').length,
        0
      ) || 0;
      console.log(
        '[SeatMap] loadSeatMap: unavailable=' + unavailableCount + ', reserving=' + reservingCount
      );
    } catch (err) {
      setError('Failed to load seat map');
      console.error(err);
      setLoading(false);
    }
  };

  const reserveSeat = async (sectionId: string, seat: SeatObject) => {
    if (seat.status !== 'available') return;

    try {
      console.log('[SeatMap] Reserving seat:', seat.seatId);
      await seatsAPI.reserveSeats({
        eventId,
        seats: [{ sectionId, seatId: seat.seatId }],
      });

      const price =
        seatMapData!.event.basePrice +
        (seatMapData?.seatingLayout.sections.find((s) => s.id === sectionId)
          ?.priceModifier || 0);

      const newSeat: SelectedSeat = {
        sectionId,
        seatId: seat.seatId,
        price,
      };

      console.log('[SeatMap] Added to selectedSeats, total now:', selectedSeats.length + 1);
      setSelectedSeats([...selectedSeats, newSeat]);
      
      // Add a small delay to ensure backend has persisted before reloading
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadSeatMap();
    } catch (err) {
      alert('Failed to reserve seat');
      console.error(err);
    }
  };

  const deselectSeat = async (sectionId: string, seatId: string) => {
    try {
      // Call API to unreserve the seat
      await seatsAPI.unreserveSeats({
        eventId,
        seats: [{ sectionId, seatId }],
      });

      // Remove from selected seats
      setSelectedSeats(
        selectedSeats.filter(
          (s) => !(s.sectionId === sectionId && s.seatId === seatId)
        )
      );

      // Reload the seat map
      await loadSeatMap();
    } catch (err) {
      alert('Failed to deselect seat');
      console.error(err);
    }
  };

  const isSeatSelected = (sectionId: string, seatId: string) => {
    return selectedSeats.some(
      (s) => s.sectionId === sectionId && s.seatId === seatId
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-block w-12 h-12 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !seatMapData) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600">{error || 'Failed to load seat map'}</p>
      </div>
    );
  }

  if (!seatMapData.seatingLayout.enabled) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-600">
          Visual seat selection not available for this event
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="text-2xl font-bold text-stone-900 mb-2">
          {seatMapData.event.name}
        </h2>
        <div className="flex flex-wrap gap-4 text-sm text-stone-600">
          <span>📍 {seatMapData.event.venue}</span>
          <span>
            📅 {new Date(seatMapData.event.date).toLocaleDateString()}
          </span>
          <span>💰 From ₹{seatMapData.event.basePrice}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-4">
        <div className="flex flex-wrap gap-6 items-center justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500 rounded border border-green-600"></div>
            <span className="text-stone-700">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-amber-500 rounded border border-amber-600"></div>
            <span className="text-stone-700">Selected/Reserving</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-500 rounded border border-red-600"></div>
            <span className="text-stone-700">Sold</span>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-stone-700 to-stone-800 rounded-2xl p-4 text-center">
        <div className="text-white font-bold text-lg">🎭 STAGE</div>
      </div>

      {seatMapData.seatingLayout.sections.map((section) => {
        const rows = Array.from(new Set(section.seats.map((s) => s.row))).sort(
          (a, b) => a - b
        );
        const columns = Array.from(
          new Set(section.seats.map((s) => s.column))
        ).sort();

        return (
          <div
            key={section.id}
            className="bg-white rounded-2xl border border-stone-200 p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-stone-900">
                {section.name}
              </h3>
              {section.priceModifier && section.priceModifier !== 0 && (
                <span className="text-sm font-semibold text-amber-600">
                  {section.priceModifier > 0 ? '+' : ''}₹
                  {section.priceModifier.toFixed(2)}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="flex gap-1 mb-1 pl-8">
                  {columns.map((col) => (
                    <div
                      key={col}
                      className="w-8 h-6 text-center text-xs font-semibold text-stone-600"
                    >
                      {col}
                    </div>
                  ))}
                </div>

                {rows.map((row) => (
                  <div key={row} className="flex gap-1 mb-1">
                    <div className="w-8 h-8 flex items-center justify-center text-xs font-semibold text-stone-600">
                      {row}
                    </div>

                    {columns.map((col) => {
                      const seat = section.seats.find(
                        (s) => s.row === row && s.column === col
                      );

                      if (!seat) {
                        return (
                          <div key={`${row}-${col}`} className="w-8 h-8" />
                        );
                      }

                      const isSelected = isSeatSelected(
                        section.id,
                        seat.seatId
                      );
                      const price =
                        seatMapData.event.basePrice +
                        (section.priceModifier || 0);

                      let bgColor = '';
                      let hoverClass = '';

                      if (seat.status === 'available') {
                        bgColor = isSelected
                          ? 'bg-amber-500 border-amber-600'
                          : 'bg-green-500 border-green-600';
                        hoverClass =
                          'hover:bg-green-600 cursor-pointer transform hover:scale-110';
                      } else if (seat.status === 'reserving') {
                        bgColor = isSelected
                          ? 'bg-amber-500 border-amber-600'
                          : 'bg-amber-400 border-amber-500';
                        hoverClass = isSelected
                          ? 'cursor-pointer opacity-100'
                          : 'cursor-not-allowed opacity-60';
                      } else {
                        bgColor = 'bg-red-500 border-red-600';
                        hoverClass = 'cursor-not-allowed opacity-60';
                      }

                      return (
                        <button
                          key={seat.seatId}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              deselectSeat(section.id, seat.seatId);
                            } else if (seat.status === 'available') {
                              reserveSeat(section.id, seat);
                            }
                          }}
                          disabled={
                            !isSelected && seat.status === 'unavailable'
                          }
                          className={`w-8 h-8 rounded border transition-all ${bgColor} ${hoverClass}`}
                          title={`${seat.seatId} - ₹${price} - ${seat.status}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {selectedSeats.length > 0 && (
        <div className="sticky bottom-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg mb-2">Selected Seats</h3>
              <div className="flex flex-wrap gap-2">
                {selectedSeats.map((seat) => (
                  <span
                    key={`${seat.sectionId}-${seat.seatId}`}
                    className="bg-white/20 px-3 py-1 rounded-lg text-sm font-semibold"
                  >
                    {seat.seatId}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">Total Amount</p>
              <p className="text-3xl font-bold">
                ₹{selectedSeats.reduce((sum, s) => sum + s.price, 0).toFixed(2)}
              </p>
              <p className="text-sm opacity-90">
                {selectedSeats.length} seat
                {selectedSeats.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
