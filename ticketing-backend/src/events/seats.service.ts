import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, Seat, SeatSection } from './event.schema';
import { AppLogger } from '../common/utils/logger';

@Injectable()
export class SeatsService {
  private readonly logger = new AppLogger(SeatsService.name);

  constructor(@InjectModel(Event.name) private eventModel: Model<Event>) {}

  async getSeatMap(eventId: string) {
    this.logger.log('Getting seat map', SeatsService.name, { eventId });

    const event = await this.eventModel.findById(eventId);
    if (!event) {
      this.logger.warn('Event not found for seat map', SeatsService.name, {
        eventId,
      });
      throw new BadRequestException('Event not found');
    }

    if (!event.seatingLayout?.enabled) {
      this.logger.log('Event has no seating layout', SeatsService.name, {
        eventId,
      });
      return {
        event: {
          id: event._id,
          name: event.name,
          venue: event.venue,
          date: event.date,
          basePrice:
            event.ticketTypes?.Free?.price ||
            event.ticketTypes?.Standard?.price ||
            0,
        },
        seatingLayout: { enabled: false, sections: [] },
      };
    }

    const unavailableSeats = event.seatingLayout.sections.flatMap((section) =>
      (section.seats && Array.isArray(section.seats) ? section.seats : [])
        .filter((s) => s.status === 'unavailable')
        .map((s) => `${section.id}/${s.seatId}`),
    );

    this.logger.log('Returning seat map', SeatsService.name, {
      eventId,
      sections: event.seatingLayout.sections.length,
      unavailable: unavailableSeats.length,
    });

    return {
      event: {
        id: event._id,
        name: event.name,
        venue: event.venue,
        date: event.date,
        basePrice:
          event.ticketTypes?.Free?.price ||
          event.ticketTypes?.Standard?.price ||
          0,
      },
      seatingLayout: {
        enabled: event.seatingLayout.enabled,
        sections: event.seatingLayout.sections.map((section) => ({
          id: section.id,
          name: section.name,
          priceModifier: section.priceModifier || 0,
          seats: (section.seats && Array.isArray(section.seats)
            ? section.seats
            : []
          ).map((seat) => {
            const basePrice =
              event.ticketTypes?.Free?.price ||
              event.ticketTypes?.Standard?.price ||
              0;
            return {
              seatId: seat.seatId,
              row: seat.row,
              column: seat.column,
              status: seat.status,
              price: basePrice + (section.priceModifier || 0),
            };
          }),
        })),
      },
    };
  }

  async initializeSeats(eventId: string, sections?: SeatSection[]) {
    this.logger.log('Initializing seats for event', SeatsService.name, {
      eventId,
      sections: sections?.length,
    });

    const event = await this.eventModel.findById(eventId);
    if (!event) {
      this.logger.warn(
        'Event not found for seat initialization',
        SeatsService.name,
        {
          eventId,
        },
      );
      throw new BadRequestException('Event not found');
    }

    // If sections not provided, get them from the event
    const sectionsToInitialize =
      sections || event.seatingLayout?.sections || [];

    const initializedSections = sectionsToInitialize.map(
      (section, sectionIndex) => ({
        id: section.id,
        name: section.name,
        columns: section.columns,
        rows: section.rows,
        orientation: section.orientation,
        priceModifier: section.priceModifier,
        accessibility: section.accessibility,
        seats: this.generateSeatMatrix(section, sectionIndex + 1),
      }),
    );

    await this.eventModel.findByIdAndUpdate(eventId, {
      'seatingLayout.sections': initializedSections,
    });

    this.logger.log('Seats initialized successfully', SeatsService.name, {
      eventId,
      totalSections: initializedSections.length,
    });

    return initializedSections;
  }

  private generateSeatMatrix(section: any, sectionNumber: number) {
    const seats: Seat[] = [];
    const rows = section.rows || 10;
    const columns = section.columns || 10;
    const startRow = section.startRow || 1;
    const startCol = section.startCol || 'A';

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        seats.push({
          seatId: `S${sectionNumber}-${String.fromCharCode(startCol.charCodeAt(0) + col)}${startRow + row}`,
          row: startRow + row,
          column: String.fromCharCode(startCol.charCodeAt(0) + col),
          status: 'available',
          reservingUntil: undefined,
        });
      }
    }

    return seats;
  }

  async finalizePurchase(
    eventId: string,
    seatIds: { sectionId: string; seatId: string }[],
  ) {
    this.logger.log('Finalizing seat purchase', SeatsService.name, {
      eventId,
      seatsCount: seatIds.length,
    });

    const event = await this.eventModel.findById(eventId);
    if (!event) {
      this.logger.warn('Event not found for seat purchase', SeatsService.name, {
        eventId,
      });
      throw new BadRequestException('Event not found');
    }

    for (const seatRequest of seatIds) {
      const section = event.seatingLayout.sections.find(
        (s) => s.id === seatRequest.sectionId,
      );
      if (!section) {
        this.logger.warn('Section not found', SeatsService.name, {
          eventId,
          sectionId: seatRequest.sectionId,
        });
        throw new BadRequestException(
          `Section ${seatRequest.sectionId} not found`,
        );
      }

      const seat =
        section.seats && Array.isArray(section.seats)
          ? section.seats.find((s) => s.seatId === seatRequest.seatId)
          : undefined;
      if (!seat) {
        this.logger.warn('Seat not found', SeatsService.name, {
          eventId,
          sectionId: seatRequest.sectionId,
          seatId: seatRequest.seatId,
        });
        throw new BadRequestException(
          `Seat ${seatRequest.seatId} not found in section ${seatRequest.sectionId}`,
        );
      }

      if (seat.status !== 'available') {
        this.logger.warn('Seat already taken', SeatsService.name, {
          eventId,
          sectionId: seatRequest.sectionId,
          seatId: seatRequest.seatId,
          status: seat.status,
        });
        throw new ConflictException(
          `Seat ${seatRequest.seatId} is no longer available (status: ${seat.status})`,
        );
      }
    }

    for (const seatRequest of seatIds) {
      const updateResult = await this.eventModel.updateOne(
        {
          _id: eventId,
        },
        {
          $set: {
            'seatingLayout.sections.$[section].seats.$[seatToLock].status':
              'unavailable',
            'seatingLayout.sections.$[section].seats.$[seatToLock].reservingUntil':
              null,
          },
        },
        {
          arrayFilters: [
            { 'section.id': seatRequest.sectionId },
            {
              'seatToLock.seatId': seatRequest.seatId,
              'seatToLock.status': 'available',
            },
          ],
        },
      );

      if (updateResult.modifiedCount === 0) {
        this.logger.warn(
          'Seat sold by concurrent customer',
          SeatsService.name,
          {
            eventId,
            sectionId: seatRequest.sectionId,
            seatId: seatRequest.seatId,
          },
        );
        throw new ConflictException(
          `Seat ${seatRequest.seatId} was just sold by another customer. Please try selecting different seats.`,
        );
      }
    }

    this.logger.log('Seats locked successfully', SeatsService.name, {
      eventId,
      lockedCount: seatIds.length,
    });

    return { soldSeats: seatIds };
  }

  async markSeatAvailable(
    eventId: string,
    sectionId: string,
    seatId: string,
  ): Promise<void> {
    this.logger.log('Marking seat as available', SeatsService.name, {
      eventId,
      sectionId,
      seatId,
    });

    const result = await this.eventModel.updateOne(
      { _id: eventId },
      {
        $set: {
          'seatingLayout.sections.$[section].seats.$[seatToFree].status':
            'available',
        },
      },
      {
        arrayFilters: [
          { 'section.id': sectionId },
          { 'seatToFree.seatId': seatId },
        ],
      },
    );

    if (result.modifiedCount === 0) {
      this.logger.warn('Failed to mark seat as available', SeatsService.name, {
        eventId,
        sectionId,
        seatId,
      });
    } else {
      this.logger.log('Seat marked as available', SeatsService.name, {
        eventId,
        sectionId,
        seatId,
      });
    }
  }
}
