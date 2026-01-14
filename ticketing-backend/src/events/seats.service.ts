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
    const unavailableSeats = event.seatingLayout.sections.flatMap((section) =>
      section.seats
        .filter((s) => s.status === 'unavailable')
        .map((s) => `${section.id}/${s.seatId}`)
    );
    console.log(
      `[SeatsService] getSeatMap called for event ${eventId}, unavailable seats:`,
      unavailableSeats
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

  // Generate seat matrix from section info (rows and columns)
  private generateSeatMatrix(section: SeatSection): Seat[] {
    const seats: Seat[] = [];
    const sectionPrefix = section.name.charAt(0).toUpperCase();

    // Parse rows and columns from section
    // Assuming section has rows and columns properties
    const rows = (section as any).rows || 10;
    const columns = (section as any).columns || 10;

    for (let row = 1; row <= rows; row++) {
      for (let col = 0; col < columns; col++) {
        const columnLetter = String.fromCharCode(65 + col); // A, B, C...
        seats.push({
          seatId: `${sectionPrefix}-${columnLetter}${row}`,
          row,
          column: columnLetter,
          status: 'available',
        });
      }
    }

    return seats;
  }

  // Reserve seats (mark as "reserving" for 20 minutes)
  async reserveSeats(
    eventId: string,
    seatIds: { sectionId: string; seatId: string }[],
  ) {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new BadRequestException('Event not found');
    }

    console.log(
      `[SeatsService] reserveSeats called with ${seatIds.length} seats:`,
      seatIds
    );

    const reservingUntil = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes

    for (const seatRequest of seatIds) {
      const section = event.seatingLayout.sections.find(
        (s) => s.id === seatRequest.sectionId,
      );
      if (!section) {
        throw new BadRequestException(
          `Section ${seatRequest.sectionId} not found`,
        );
      }

      const seat = section.seats.find((s) => s.seatId === seatRequest.seatId);
      if (!seat) {
        throw new BadRequestException(
          `Seat ${seatRequest.seatId} not found in section ${seatRequest.sectionId}`,
        );
      }

      if (seat.status === 'unavailable') {
        throw new ConflictException(
          `Seat ${seatRequest.seatId} is already sold`,
        );
      }

      // Mark as reserving
      seat.status = 'reserving';
      seat.reservingUntil = reservingUntil;
      console.log(
        `[SeatsService] Marked seat ${seatRequest.seatId} as reserving`
      );
    }

    // Mark the seatingLayout as modified so Mongoose will save it
    console.log(
      '[SeatsService] Marking seatingLayout as modified for reserveSeats'
    );
    event.markModified('seatingLayout');

    // Save the event with updated seat statuses
    await event.save();
    console.log(`[SeatsService] Saved event after reserving ${seatIds.length} seats`);

    return {
      reservedSeats: seatIds,
      expiresAt: reservingUntil,
    };
  }

  // Finalize purchase - mark seats as unavailable permanently
  async finalizePurchase(
    eventId: string,
    seatIds: { sectionId: string; seatId: string }[],
  ) {
    console.log('[SeatsService] finalizePurchase called for eventId:', eventId);
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new BadRequestException('Event not found');
    }

    console.log(
      '[SeatsService] Event found. Available sections:',
      event.seatingLayout.sections.map((s) => s.id),
    );

    let seatsModified = false;
    for (const seatRequest of seatIds) {
      console.log('[SeatsService] Processing seat request:', seatRequest);
      const section = event.seatingLayout.sections.find(
        (s) => s.id === seatRequest.sectionId,
      );
      console.log(
        '[SeatsService] Section found:',
        !!section,
        'Looking for section:',
        seatRequest.sectionId,
      );

      if (!section) {
        console.log('[SeatsService] Section not found, skipping');
        continue; // Skip if section not found
      }

      const seat = section.seats.find((s) => s.seatId === seatRequest.seatId);
      console.log(
        '[SeatsService] Seat found:',
        !!seat,
        'Current status:',
        seat?.status,
      );

      if (seat) {
        console.log(
          '[SeatsService] Marking seat unavailable:',
          seatRequest.seatId,
        );
        seat.status = 'unavailable'; // Permanently sold
        seat.reservingUntil = undefined; // Clear reservation timer
        seatsModified = true;
      }
    }

    // Mark the seatingLayout as modified so Mongoose will save it
    if (seatsModified) {
      console.log(
        '[SeatsService] Marking seatingLayout as modified for Mongoose',
      );
      event.markModified('seatingLayout');
    }

    console.log('[SeatsService] Saving event...');
    await event.save();
    console.log('[SeatsService] Event saved successfully');

    // Verify what was actually saved
    const savedEvent = await this.eventModel.findById(event._id);
    if (savedEvent) {
      const savedUnavailableSeats = savedEvent.seatingLayout.sections.flatMap(
        (section) =>
          section.seats
            .filter((s) => s.status === 'unavailable')
            .map((s) => `${section.id}/${s.seatId}`)
      );
      console.log(
        '[SeatsService] After finalizePurchase, unavailable seats in DB:',
        savedUnavailableSeats
      );
    }

    return { soldSeats: seatIds };
  }

  // Unreserve seats (revert "reserving" back to "available")
  async unreserveSeats(
    eventId: string,
    seatIds: { sectionId: string; seatId: string }[],
  ) {
    const event = await this.eventModel.findById(eventId);
    if (!event) {
      throw new BadRequestException('Event not found');
    }

    for (const seatRequest of seatIds) {
      const section = event.seatingLayout.sections.find(
        (s) => s.id === seatRequest.sectionId,
      );
      if (!section) {
        continue;
      }

      const seat = section.seats.find((s) => s.seatId === seatRequest.seatId);
      if (seat && seat.status === 'reserving') {
        seat.status = 'available';
        seat.reservingUntil = undefined;
      }
    }

    event.markModified('seatingLayout');
    await event.save();

    return { unreservedSeats: seatIds };
  }

  // Cron job: Release expired reservations (revert "reserving" to "available")
  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredReservations() {
    const now = new Date();

    // Find all events with reserving seats that have expired
    const events = await this.eventModel.find({
      'seatingLayout.sections.seats.status': 'reserving',
    });

    let totalReleased = 0;

    for (const event of events) {
      let eventModified = false;

      for (const section of event.seatingLayout.sections) {
        for (const seat of section.seats) {
          if (
            seat.status === 'reserving' &&
            seat.reservingUntil &&
            seat.reservingUntil < now
          ) {
            seat.status = 'available';
            seat.reservingUntil = undefined;
            eventModified = true;
            totalReleased++;
          }
        }
      }

      if (eventModified) {
        event.markModified('seatingLayout');
        await event.save();
      }
    }

    if (totalReleased > 0) {
      console.log(`Released ${totalReleased} expired seat reservations`);
    }
  }
}
