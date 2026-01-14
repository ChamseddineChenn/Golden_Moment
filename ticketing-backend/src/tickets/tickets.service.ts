import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as QRCode from 'qrcode';
import { Ticket, TicketStatus } from './ticket.schema';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { EventsService } from '../events/events.service';
import { SeatsService } from '../events/seats.service';

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<Ticket>,
    private readonly eventsService: EventsService,
    private readonly seatsService: SeatsService,
  ) {}

  // Generate unique ticket number using MongoDB counter pattern
  private async generateTicketNumber(): Promise<string> {
    let ticketNumber = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const count = await this.ticketModel.countDocuments();
      ticketNumber = `TK${String(count + attempts + 1).padStart(6, '0')}`;

      try {
        // Try to find if this number exists
        const existing = await this.ticketModel.findOne({ ticketNumber });
        if (!existing) {
          isUnique = true;
        }
      } catch (err) {
        // Continue trying
      }
      attempts++;
    }

    if (!isUnique) {
      throw new ConflictException('Failed to generate unique ticket number');
    }

    return ticketNumber;
  }

  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
    console.log(
      '[TicketsService] ========== TICKET CREATION START ==========',
    );
    console.log(
      '[TicketsService] Creating ticket for event:',
      createTicketDto.eventId,
    );
    console.log('[TicketsService] Requested seats:', createTicketDto.seats);

    // Get event details to check if event has passed
    const event = await this.eventsService.findById(
      createTicketDto.eventId.toString(),
    );

    if (!event) {
      throw new Error('Event not found');
    }

    // Check if event date has passed
    const now = new Date();
    const eventDate = new Date(event.date);
    if (eventDate < now) {
      throw new Error('Cannot purchase tickets for past events');
    }

    // Auto-assign seats if not provided (single auto-assigned seat)
    if (!createTicketDto.seats || createTicketDto.seats.length === 0) {
      console.log('[TicketsService] No seats provided, auto-assigning...');
      const ticketCountForEvent = await this.ticketModel.countDocuments({
        eventId: createTicketDto.eventId,
      });
      createTicketDto.seats = [
        {
          seatId: `SEAT-${String(ticketCountForEvent + 1).padStart(4, '0')}`,
        },
      ];
    }

    // ⚠️ CRITICAL: LOCK SEATS BEFORE CREATING TICKET
    // This ensures atomicity - if seat locking fails, ticket creation is never attempted
    const seatsWithSection = createTicketDto.seats.filter(
      (s) => s.sectionId,
    );

    if (seatsWithSection.length > 0) {
      console.log(
        '[TicketsService] ⚠️  CRITICAL SECTION: Atomically locking seats BEFORE ticket creation',
      );
      console.log(
        '[TicketsService] Seats to lock:',
        seatsWithSection.map((s) => `${s.sectionId}/${s.seatId}`).join(', '),
      );

      try {
        // Call finalizePurchase BEFORE ticket creation
        // If this fails, ticket is NOT created - preserving atomicity
        await this.seatsService.finalizePurchase(
          createTicketDto.eventId.toString(),
          seatsWithSection as { sectionId: string; seatId: string }[],
        );
        console.log(
          '[TicketsService] ✅ Seats successfully locked (atomic operation)',
        );
      } catch (err: any) {
        // DO NOT CATCH race conditions - let them propagate!
        // This ensures the client knows the purchase failed due to double-booking
        console.error(
          '[TicketsService] ❌ CRITICAL: Seat locking FAILED - Aborting ticket creation',
        );
        console.error('[TicketsService] Error details:', err.message);
        throw err; // Re-throw so ticket is never created
      }
    } else {
      console.log(
        '[TicketsService] No seats with sectionId (auto-assigned seat case)',
      );
    }

    // Auto-generate unique ticket number
    const ticketNumber = await this.generateTicketNumber();

    // Calculate expiration time (15 minutes after event start)
    const expiresAt = new Date(eventDate.getTime() + 15 * 60 * 1000);

    // Generate QR code data (contains ticket info)
    const qrData = {
      ticketNumber,
      eventId: createTicketDto.eventId,
      seats: createTicketDto.seats,
      timestamp: new Date().toISOString(),
    };

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData));

    // Calculate total price based on seats
    let totalPrice = 0;
    if (
      createTicketDto.seats &&
      createTicketDto.seats.length > 0 &&
      event.seatingLayout?.enabled
    ) {
      // For visual seating, calculate price per seat
      for (const seat of createTicketDto.seats) {
        const section = event.seatingLayout.sections.find(
          (s) => s.id === seat.sectionId,
        );
        if (section) {
          totalPrice += event.ticketPrice + (section.priceModifier || 0);
        } else {
          totalPrice += event.ticketPrice;
        }
      }
    } else {
      // For non-visual seating, use base ticket price
      totalPrice = event.ticketPrice || 0;
    }

    console.log('[TicketsService] Creating ticket document...');
    const ticketData = {
      eventId: createTicketDto.eventId,
      seats: createTicketDto.seats,
      buyerEmail: createTicketDto.buyerEmail,
      buyerName: createTicketDto.buyerName,
      ticketNumber,
      qrCode,
      expiresAt,
      totalPrice,
      metadata: createTicketDto.metadata || {},
    };

    const createdTicket = new this.ticketModel(ticketData);
    const savedTicket = await createdTicket.save();
    console.log('[TicketsService] ✅ Ticket created successfully:', savedTicket._id);

    // Update event's sold tickets count
    // For visual seating: count unavailable seats, otherwise count tickets
    if (event.seatingLayout?.enabled) {
      // Count unavailable seats across all sections
      let unavailableSeatsCount = 0;
      for (const section of event.seatingLayout.sections) {
        unavailableSeatsCount += section.seats.filter(
          (s) => s.status === 'unavailable',
        ).length;
      }
      await this.eventsService.update(createTicketDto.eventId.toString(), {
        soldTickets: unavailableSeatsCount,
      });
      console.log(
        '[TicketsService] Updated event soldTickets count:',
        unavailableSeatsCount,
      );
    } else {
      // For non-visual seating: count tickets
      const ticketCountForEvent = await this.ticketModel.countDocuments({
        eventId: createTicketDto.eventId,
      });
      await this.eventsService.update(createTicketDto.eventId.toString(), {
        soldTickets: ticketCountForEvent,
      });
    }

    console.log('[TicketsService] ========== TICKET CREATION SUCCESS ==========');
    return savedTicket;
  }

  // Helper method to update expired tickets based on event date
  private async updateExpiredTickets(): Promise<void> {
    const now = new Date();

    // Find all tickets that are still "valid" and belong to events that have passed
    const validTickets = await this.ticketModel
      .find({ status: TicketStatus.VALID })
      .populate('eventId')
      .exec();

    for (const ticket of validTickets) {
      // Check if eventId is populated (is an object with date property)
      if (
        ticket.eventId &&
        typeof ticket.eventId === 'object' &&
        'date' in ticket.eventId
      ) {
        const eventDate = new Date((ticket.eventId as any).date);
        // If event date has passed, mark ticket as expired
        if (eventDate < now) {
          await this.ticketModel.findByIdAndUpdate(ticket._id, {
            status: TicketStatus.EXPIRED,
          });
        }
      }
    }
  }

  async findByEventId(eventId: string): Promise<Ticket[]> {
    await this.updateExpiredTickets();
    return this.ticketModel.find({ eventId }).populate('eventId').exec();
  }

  async findById(ticketId: string): Promise<Ticket | null> {
    return this.ticketModel.findById(ticketId).populate('eventId').exec();
  }

  async findAll(): Promise<Ticket[]> {
    await this.updateExpiredTickets();
    return this.ticketModel.find().populate('eventId').exec();
  }

  async search(query: string): Promise<Ticket[]> {
    // Search by ticket number, event name, ticket holder name, or email
    return this.ticketModel
      .find({
        $or: [
          { ticketNumber: { $regex: query, $options: 'i' } },
          { buyerName: { $regex: query, $options: 'i' } },
          { buyerEmail: { $regex: query, $options: 'i' } },
        ],
      })
      .populate('eventId')
      .exec();
  }

  async markAsUsed(ticketId: string): Promise<Ticket | null> {
    return this.ticketModel
      .findByIdAndUpdate(
        ticketId,
        {
          status: TicketStatus.USED,
          usedAt: new Date(),
        },
        { new: true },
      )
      .exec();
  }

  async validateTicketByNumber(ticketNumber: string): Promise<{
    success: boolean;
    message: string;
    ticket?: Ticket;
  }> {
    const ticket = await this.ticketModel
      .findOne({ ticketNumber })
      .populate('eventId')
      .exec();

    if (!ticket) {
      return {
        success: false,
        message: 'Ticket not found. This QR code is invalid.',
      };
    }

    // Check if ticket is expired (15 minutes after event start)
    const now = new Date();
    if (ticket.expiresAt && now > new Date(ticket.expiresAt)) {
      // Update status to expired if not already
      if (ticket.status !== TicketStatus.EXPIRED) {
        await this.ticketModel.findByIdAndUpdate(ticket._id, {
          status: TicketStatus.EXPIRED,
        });
        ticket.status = TicketStatus.EXPIRED;
      }
      return {
        success: false,
        message:
          'This ticket has expired. The 15-minute entry window has closed.',
        ticket,
      };
    }

    if (ticket.status === TicketStatus.USED) {
      return {
        success: false,
        message: `This ticket has already been used on ${ticket.usedAt?.toLocaleString() || 'a previous date'}.`,
        ticket,
      };
    }

    if (ticket.status === TicketStatus.EXPIRED) {
      return {
        success: false,
        message: 'This ticket has expired.',
        ticket,
      };
    }

    // Mark as used
    const updatedTicket = await this.ticketModel
      .findByIdAndUpdate(
        ticket._id,
        {
          status: TicketStatus.USED,
          usedAt: new Date(),
        },
        { new: true },
      )
      .populate('eventId')
      .exec();

    return {
      success: true,
      message: 'Ticket validated successfully! Entry granted.',
      ticket: updatedTicket || ticket,
    };
  }

  async findByTicketNumber(ticketNumber: string): Promise<Ticket | null> {
    return this.ticketModel
      .findOne({ ticketNumber })
      .populate('eventId')
      .exec();
  }
}
