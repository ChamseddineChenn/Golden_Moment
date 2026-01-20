import { FilterState } from '@/components/EventFilters';

export interface Event {
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

export function applyFilters(events: Event[], filters: FilterState): Event[] {
  return events.filter((event) => {
    // Search filter - match name and description
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesName = event.name.toLowerCase().includes(query);
      const matchesDescription = event.description
        .toLowerCase()
        .includes(query);
      if (!matchesName && !matchesDescription) {
        return false;
      }
    }

    // Date filter - exact date match (ignore time)
    if (filters.selectedDate) {
      const filterDate = new Date(filters.selectedDate).toDateString();
      const eventDate = new Date(event.date).toDateString();
      if (filterDate !== eventDate) {
        return false;
      }
    }

    // Ticket type filter - check if event has any selected ticket type enabled
    if (filters.selectedTicketTypes.length > 0) {
      const eventHasSelectedType = filters.selectedTicketTypes.some(
        (selectedType) => {
          // Check if this ticket type is available in the event
          const ticketType =
            event.ticketTypes?.[selectedType as keyof typeof event.ticketTypes];
          return ticketType?.enabled;
        },
      );

      if (!eventHasSelectedType) {
        return false;
      }
    }

    // Price filter
    if (filters.priceFilterType !== 'all') {
      // Get all available prices for this event
      const eventPrices: number[] = [];

      if (event.ticketTypes?.Free?.enabled) {
        eventPrices.push(0);
      }
      if (
        event.ticketTypes?.Standard?.enabled &&
        event.ticketTypes.Standard.price !== undefined
      ) {
        eventPrices.push(event.ticketTypes.Standard.price);
      }
      if (
        event.ticketTypes?.EarlyBird?.enabled &&
        event.ticketTypes.EarlyBird.price !== undefined
      ) {
        eventPrices.push(event.ticketTypes.EarlyBird.price);
      }
      if (
        event.ticketTypes?.VIP?.enabled &&
        event.ticketTypes.VIP.price !== undefined
      ) {
        eventPrices.push(event.ticketTypes.VIP.price);
      }

      if (filters.priceFilterType === 'range') {
        const minPrice = filters.minPrice ? parseFloat(filters.minPrice) : 0;
        const maxPrice = filters.maxPrice
          ? parseFloat(filters.maxPrice)
          : Infinity;

        // Check if event has at least one price within the range
        const hasPriceInRange = eventPrices.some(
          (price) => price >= minPrice && price <= maxPrice,
        );

        if (!hasPriceInRange) {
          return false;
        }
      }
    }

    return true;
  });
}

// Get all unique ticket types from a list of events
export function getAvailableTicketTypes(events: Event[]): string[] {
  const types = new Set<string>();

  events.forEach((event) => {
    if (event.ticketTypes) {
      if (event.ticketTypes.Free?.enabled) types.add('Free');
      if (event.ticketTypes.Standard?.enabled) types.add('Standard');
      if (event.ticketTypes.EarlyBird?.enabled) types.add('EarlyBird');
      if (event.ticketTypes.VIP?.enabled) types.add('VIP');
    }
  });

  // Return in consistent order
  const order = ['Free', 'EarlyBird', 'Standard', 'VIP'];
  return order.filter((type) => types.has(type));
}
