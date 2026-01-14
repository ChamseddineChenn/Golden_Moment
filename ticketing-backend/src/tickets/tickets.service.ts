import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { Ticket, TicketStatus } from './ticket.schema';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { EventsService } from '../events/events.service';
import { SeatsService } from '../events/seats.service';

@Injectable()
export class TicketsService {
  private readonly encryptionKey =
    process.env.QR_ENCRYPTION_KEY ||
    'default-insecure-key-change-in-production';
  private readonly algorithm = 'aes-256-gcm';

  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<Ticket>,
    private readonly eventsService: EventsService,
    private readonly seatsService: SeatsService,
  ) {}

  // Generate a secure encrypted QR token
  private generateQrToken(): { token: string; encryptedToken: string } {
    const token = crypto.randomBytes(32).toString('hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)),
      iv,
    );
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    return { token, encryptedToken };
  }

  // Decrypt an encrypted QR token
  private decryptQrToken(encryptedToken: string): string | null {
    try {
      const parts = encryptedToken.split(':');
      if (parts.length !== 3) {
        console.error('[TicketsService] Invalid encrypted token format');
        return null;
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)),
        iv,
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[TicketsService] Decryption error:', error);
      return null;
    }
  }

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
    console.log('[TicketsService] ========== TICKET CREATION START ==========');
    console.log('[TicketsService] EventID:', createTicketDto.eventId);
    console.log('[TicketsService] Seats requested:', createTicketDto.seats);
    console.log(
      '[TicketsService] Buyer:',
      createTicketDto.buyerName,
      '<',
      createTicketDto.buyerEmail,
      '>',
    );

    // Get event details
    const event = await this.eventsService.findById(
      createTicketDto.eventId.toString(),
    );

    if (!event) {
      console.error('[TicketsService] ERROR: Event not found');
      throw new Error('Event not found');
    }

    // Check if event date has passed
    const now = new Date();
    const eventDate = new Date(event.date);
    if (eventDate < now) {
      throw new Error('Cannot purchase tickets for past events');
    }

    // Auto-assign seats if not provided
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

    // CRITICAL: Atomically lock seats BEFORE creating ticket
    // This prevents double-booking by ensuring only one customer can buy each seat
    const seatsWithSection = createTicketDto.seats.filter((s) => s.sectionId);

    if (seatsWithSection.length > 0) {
      console.log(
        '[TicketsService] CRITICAL: Locking seats before ticket creation',
      );
      console.log(
        '[TicketsService] Seats with sectionId:',
        seatsWithSection.length,
      );

      // Call finalizePurchase - this will throw ConflictException if seat already sold
      // If this throws, the ticket will NEVER be created
      await this.seatsService.finalizePurchase(
        createTicketDto.eventId.toString(),
        seatsWithSection as { sectionId: string; seatId: string }[],
      );
      console.log('[TicketsService] ✅ Seats atomically locked successfully');
    } else {
      console.log(
        '[TicketsService] No seats with sectionId (auto-assigned case)',
      );
    }

    // NOW create the ticket (after seats are locked)
    const ticketNumber = await this.generateTicketNumber();
    const expiresAt = new Date(eventDate.getTime() + 15 * 60 * 1000);

    // Generate secure QR token
    const { token, encryptedToken } = this.generateQrToken();

    // QR code only contains the encrypted token (not sensitive data)
    const qrCode = await QRCode.toDataURL(encryptedToken);

    // Calculate total price
    let totalPrice = 0;
    if (
      createTicketDto.seats &&
      createTicketDto.seats.length > 0 &&
      event.seatingLayout?.enabled
    ) {
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
      qrToken: token,
      expiresAt,
      totalPrice,
      metadata: createTicketDto.metadata || {},
    };

    const createdTicket = new this.ticketModel(ticketData);
    const savedTicket = await createdTicket.save();
    console.log('[TicketsService] ✅ Ticket saved:', savedTicket._id);

    // Update event's sold tickets count
    if (event.seatingLayout?.enabled) {
      // IMPORTANT: Fetch the event AGAIN to get the updated seat statuses after locking
      const updatedEvent = await this.eventsService.findById(
        createTicketDto.eventId.toString(),
      );
      if (updatedEvent?.seatingLayout) {
        let unavailableSeatsCount = 0;
        for (const section of updatedEvent.seatingLayout.sections) {
          unavailableSeatsCount += section.seats.filter(
            (s) => s.status === 'unavailable',
          ).length;
        }
        await this.eventsService.update(createTicketDto.eventId.toString(), {
          soldTickets: unavailableSeatsCount,
        });
        console.log(
          '[TicketsService] Updated soldTickets count:',
          unavailableSeatsCount,
        );
      }
    } else {
      const ticketCountForEvent = await this.ticketModel.countDocuments({
        eventId: createTicketDto.eventId,
      });
      await this.eventsService.update(createTicketDto.eventId.toString(), {
        soldTickets: ticketCountForEvent,
      });
    }

    console.log(
      '[TicketsService] ========== TICKET CREATION SUCCESS ==========',
    );
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

  async validateByQRToken(encryptedToken: string): Promise<{
    success: boolean;
    message: string;
    ticket?: Ticket;
  }> {
    // Decrypt the token
    const plainToken = this.decryptQrToken(encryptedToken);
    if (!plainToken) {
      return {
        success: false,
        message: 'Invalid QR code format. Could not decrypt token.',
      };
    }

    // Find ticket by qrToken
    const ticket = await this.ticketModel
      .findOne({ qrToken: plainToken })
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
