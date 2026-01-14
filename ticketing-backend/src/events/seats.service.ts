import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, Seat, SeatSection } from './event.schema';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SeatsService {
  constructor(@InjectModel(Event.name) private eventModel: Model<Event>) {}

  // Get seat map for an event - returns current seat statuses
  async getSeatMap(eventId: string) {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new BadRequestException('Event not found');
    }

    if (!event.seatingLayout?.enabled) {
      return {
        event: {
          id: event._id,
          name: event.name,
          venue: event.venue,
          date: event.date,
          basePrice: event.ticketPrice,
        },
        seatingLayout: { enabled: false, sections: [] },
      };
    }

    // Log the seat statuses for debugging
    const reservingSeats = event.seatingLayout.sections.flatMap((section) =>
      section.seats
        .filter((s) => s.status === 'reserving')
        .map((s) => `${section.id}/${s.seatId}`),
    );
    const unavailableSeats = event.seatingLayout.sections.flatMap((section) =>
      section.seats
        .filter((s) => s.status === 'unavailable')
        .map((s) => `${section.id}/${s.seatId}`),
    );
    console.log(
      `[SeatsService] getSeatMap: reserving=${reservingSeats.length} [${reservingSeats.join(', ')}], unavailable=${unavailableSeats.length}`,
    );

    // Return the seating layout with current seat statuses
    return {
      event: {
        id: event._id,
        name: event.name,
        venue: event.venue,
        date: event.date,
        basePrice: event.ticketPrice,
      },
      seatingLayout: {
        enabled: event.seatingLayout.enabled,
        sections: event.seatingLayout.sections.map((section) => ({
          id: section.id,
          name: section.name,
          priceModifier: section.priceModifier || 0,
          seats: section.seats.map((seat) => ({
            seatId: seat.seatId,
            row: seat.row,
            column: seat.column,
            status: seat.status,
            price: event.ticketPrice + (section.priceModifier || 0),
          })),
        })),
      },
    };
  }

  // Initialize seats for an event when seating is created
  async initializeSeats(eventId: string, sections: SeatSection[]) {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new BadRequestException('Event not found');
    }

    // Generate seat matrix for each section
    const initializedSections = sections.map((section) => ({
      id: section.id,
      name: section.name,
      priceModifier: section.priceModifier,
      accessibility: section.accessibility,
      seats: this.generateSeatMatrix(section),
    }));

    // Update event with initialized seating
    await this.eventModel.findByIdAndUpdate(eventId, {
      'seatingLayout.sections': initializedSections,
    });

    return initializedSections;
  }

  // Helper function to generate a seat matrix
  private generateSeatMatrix(section: any) {
    const seats: Seat[] = [];
    const rows = section.rows || 10;
    const columns = section.columns || 10;
    const startRow = section.startRow || 1;
    const startCol = section.startCol || 'A';

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        seats.push({
          seatId: `${section.id}-${startRow + row}${String.fromCharCode(startCol.charCodeAt(0) + col)}`,
          row: startRow + row,
          column: String.fromCharCode(startCol.charCodeAt(0) + col),
          status: 'available',
          reservingUntil: undefined,
        });
      }
    }

    return seats;
  }

  // DEPRECATED: Live reservation removed - seats only locked at payment
  async reserveSeats(
    eventId: string,
    seatIds: { sectionId: string; seatId: string }[],
  ) {
    console.log('[SeatsService] reserveSeats is DEPRECATED - live reservation disabled');
    throw new BadRequestException(
      'Live reservation disabled. Seats are locked only at payment time. Please proceed to checkout to finalize your seats.',
    );
  }

  // DEPRECATED: Unreserve is no longer needed since live reservation is disabled
  async unreserveSeats(
    eventId: string,
    seatIds: { sectionId: string; seatId: string }[],
  ) {
    console.log('[SeatsService] unreserveSeats is DEPRECATED - live reservation disabled');
    throw new BadRequestException(
      'Unreserve is no longer available. Seats are only locked at payment time.',
    );
  }

  // ATOMIC PAYMENT-BASED SEAT LOCKING
  // SECURITY: Uses MongoDB atomic operations with race condition detection
  // If any seat is no longer 'available' when we try to buy it, rejects with 409 Conflict
  async finalizePurchase(
    eventId: string,
    seatIds: { sectionId: string; seatId: string }[],
  ) {
    console.log('='.repeat(80));
    console.log('[SeatsService] ========== FINALIZE PURCHASE START ==========');
    console.log('[SeatsService] EventID:', eventId);
    console.log(
      '[SeatsService] Seats to lock:',
      seatIds.map((s) => `${s.sectionId}/${s.seatId}`).join(', '),
    );

    const event = await this.eventModel.findById(eventId);
    if (!event) {
      console.error('[SeatsService] ERROR: Event not found!');
      throw new BadRequestException('Event not found');
    }

    // SECURITY CHECK #1: Pre-verify all seats are still available
    console.log(
      '[SeatsService] SECURITY CHECK #1: Verifying all seats are available...',
    );
    for (const seatRequest of seatIds) {
      const section = event.seatingLayout.sections.find(
        (s) => s.id === seatRequest.sectionId,
      );
      if (!section) {
        console.error(
          `[SeatsService] ERROR: Section ${seatRequest.sectionId} not found!`,
        );
        throw new BadRequestException(
          `Section ${seatRequest.sectionId} not found`,
        );
      }

      const seat = section.seats.find((s) => s.seatId === seatRequest.seatId);
      if (!seat) {
        console.error(
          `[SeatsService] ERROR: Seat ${seatRequest.seatId} not found in section!`,
        );
        throw new BadRequestException(
          `Seat ${seatRequest.seatId} not found in section ${seatRequest.sectionId}`,
        );
      }

      if (seat.status !== 'available') {
        console.error(
          `[SeatsService] ❌ RACE CONDITION DETECTED: Seat ${seatRequest.seatId} already ${seat.status}!`,
        );
        throw new ConflictException(
          `Seat ${seatRequest.seatId} is no longer available (status: ${seat.status})`,
        );
      }
      console.log(
        `[SeatsService]   ✅ Seat ${seatRequest.seatId} is available`,
      );
    }

    // SECURITY CHECK #2: Atomically mark ALL seats as unavailable
    // This uses MongoDB's arrayFilters to target specific seats
    // If the query condition fails (seat is no longer available), modifiedCount will be 0
    console.log(
      '[SeatsService] SECURITY CHECK #2: Atomically locking seats via MongoDB...',
    );

    for (const seatRequest of seatIds) {
      console.log(
        `[SeatsService]   Locking seat: ${seatRequest.sectionId}/${seatRequest.seatId}`,
      );

      // Atomic update: Only mark as unavailable IF it's still available
      const updateResult = await this.eventModel.updateOne(
        {
          _id: eventId,
        },
        {
          $set: {
            'seatingLayout.sections.$[section].seats.$[seatToLock].status': 'unavailable',
            'seatingLayout.sections.$[section].seats.$[seatToLock].reservingUntil': null,
          },
        },
        {
          arrayFilters: [
            { 'section.id': seatRequest.sectionId },
            { 'seatToLock.seatId': seatRequest.seatId, 'seatToLock.status': 'available' }, // CONDITION: only update if available
          ],
        },
      );

      console.log(
        `[SeatsService]   MongoDB updateOne result - matchedCount: ${updateResult.matchedCount}, modifiedCount: ${updateResult.modifiedCount}`,
      );

      // If modifiedCount is 0, another customer bought this seat during checkout!
      if (updateResult.modifiedCount === 0) {
        console.error(
          `[SeatsService] ❌ CRITICAL: RACE CONDITION DETECTED - Seat ${seatRequest.seatId} was sold by another customer!`,
        );
        console.error(
          `[SeatsService] This means two customers tried to buy the same seat simultaneously.`,
        );
        throw new ConflictException(
          `Seat ${seatRequest.seatId} was just sold by another customer. Please try selecting different seats.`,
        );
      }

      console.log(
        `[SeatsService]   ✅ Seat ${seatRequest.seatId} ATOMICALLY LOCKED (unavailable)`,
      );
    }

    // Verify final state in database
    const verifyEvent = await this.eventModel.findById(eventId);
    if (verifyEvent) {
      const finalUnavailableSeats = verifyEvent.seatingLayout.sections.flatMap(
        (section) =>
          section.seats
            .filter((s) => s.status === 'unavailable')
            .map((s) => `${section.id}/${s.seatId}`),
      );
      console.log(
        '[SeatsService] Final verification - Total unavailable seats in DB:',
        finalUnavailableSeats.length,
        `[${finalUnavailableSeats.join(', ')}]`,
      );
    }

    console.log('[SeatsService] ========== FINALIZE PURCHASE SUCCESS ==========');
    console.log('='.repeat(80));
    return { soldSeats: seatIds };
  }

  // NO LONGER NEEDED: Cron job for expired reservations is removed
  // Since live reservations are disabled, there's nothing to expire
  // All seats are either 'available' or 'unavailable' (sold)
}
