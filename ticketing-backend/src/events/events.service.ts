import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event } from './event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { SeatsService } from './seats.service';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<Event>,
    private seatsService: SeatsService,
    private uploadService: UploadService,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    try {
      console.log(
        '[EventsService] Creating event with data:',
        JSON.stringify(createEventDto, null, 2),
      );

      // Ensure category is set, default to 'Concert' if not provided
      const eventData: any = {
        ...createEventDto,
        category: createEventDto.category || 'Concert',
      };

      // Convert date to Date object if it's a string
      if (typeof eventData.date === 'string') {
        eventData.date = new Date(eventData.date);
      }

      // Calculate totalSeats from seating layout if not provided
      if (!eventData.totalSeats && eventData.seatingLayout?.sections) {
        eventData.totalSeats = eventData.seatingLayout.sections.reduce(
          (total: number, section: any) => {
            return total + (section.columns || 0) * (section.rows || 0);
          },
          0,
        );
        console.log(
          '[EventsService] Calculated totalSeats from seating layout:',
          eventData.totalSeats,
        );
      } else if (!eventData.totalSeats) {
        // Default to 0 if not provided and no seating layout
        eventData.totalSeats = 0;
      }

      // Ensure ticketTypes has the proper structure
      if (!eventData.ticketTypes) {
        eventData.ticketTypes = {
          Free: { enabled: true, price: 0 },
          Standard: { enabled: false, price: 0 },
          EarlyBird: { enabled: false, price: 0, limit: 0 },
          VIP: { enabled: false, price: 0 },
        };
      } else {
        // Fill in any missing ticketType fields
        eventData.ticketTypes = {
          Free: eventData.ticketTypes.Free || {
            enabled: true,
            price: 0,
          },
          Standard: eventData.ticketTypes.Standard || {
            enabled: false,
            price: 0,
          },
          EarlyBird: eventData.ticketTypes.EarlyBird || {
            enabled: false,
            price: 0,
            limit: 0,
          },
          VIP: eventData.ticketTypes.VIP || {
            enabled: false,
            price: 0,
          },
        };
      }

      console.log(
        '[EventsService] Processed event data:',
        JSON.stringify(eventData, null, 2),
      );

      const createdEvent = new this.eventModel(eventData);
      const savedEvent = await createdEvent.save();

      console.log(
        '[EventsService] Event saved successfully with ID:',
        savedEvent._id,
      );

      // If seating is enabled, initialize the seat matrix
      if (
        createEventDto.seatingLayout?.enabled &&
        createEventDto.seatingLayout?.sections?.length > 0
      ) {
        await this.seatsService.initializeSeats(
          savedEvent._id.toString(),
          createEventDto.seatingLayout.sections,
        );
        // Reload the event to get the initialized seating
        const reloadedEvent = await this.eventModel
          .findById(savedEvent._id)
          .exec();
        return reloadedEvent || savedEvent;
      }

      return savedEvent;
    } catch (error) {
      console.error('[EventsService] Error creating event:', error);
      throw error;
    }
  }

  async findAll(): Promise<Event[]> {
    const events = await this.eventModel.find({ isActive: true }).exec();
    console.log(
      '[EventsService] findAll returning events:',
      events.map((e) => ({ id: e._id, name: e.name, category: e.category })),
    );
    return events;
  }

  async findAllPublished(): Promise<Event[]> {
    // Only return published events (hide drafts from customers)
    let events = await this.eventModel
      .find({ isActive: true, isDraft: false })
      .exec();
    // Ensure all events have totalSeats calculated
    events = events.map((event: any) => {
      if (!event.totalSeats || event.totalSeats === 0) {
        if (
          event.seatingLayout?.sections &&
          Array.isArray(event.seatingLayout.sections)
        ) {
          event.totalSeats = event.seatingLayout.sections.reduce(
            (total: number, section: any) => {
              // Sections have their own rows/columns that need multiplication
              if (section.rows && section.columns) {
                return total + section.columns * section.rows;
              }
              // Or if they already have seats array, count those
              return total + (section.seats?.length || 0);
            },
            0,
          );
        } else {
          event.totalSeats = 0;
        }
      }
      return event;
    });
    console.log(
      '[EventsService] findAllPublished returning totalSeats:',
      events.slice(0, 1).map((e: any) => e.totalSeats),
    );
    return events;
  }

  async findAllAdmin(): Promise<Event[]> {
    // Return all events for admin (including drafts, excluding inactive)
    let events = await this.eventModel.find({ isActive: true }).exec();
    // Ensure all events have totalSeats calculated
    events = events.map((event: any) => {
      if (!event.totalSeats || event.totalSeats === 0) {
        if (
          event.seatingLayout?.sections &&
          Array.isArray(event.seatingLayout.sections)
        ) {
          event.totalSeats = event.seatingLayout.sections.reduce(
            (total: number, section: any) => {
              // Sections have their own rows/columns that need multiplication
              if (section.rows && section.columns) {
                return total + section.columns * section.rows;
              }
              // Or if they already have seats array, count those
              return total + (section.seats?.length || 0);
            },
            0,
          );
        } else {
          event.totalSeats = 0;
        }
      }
      return event;
    });
    console.log(
      '[EventsService] findAllAdmin returning totalSeats:',
      events.slice(0, 1).map((e: any) => e.totalSeats),
    );
    return events;
  }

  async findById(id: string): Promise<Event | null> {
    const event = await this.eventModel.findById(id).exec();
    if (event && (!event.totalSeats || event.totalSeats === 0)) {
      if (
        (event as any).seatingLayout?.sections &&
        Array.isArray((event as any).seatingLayout.sections)
      ) {
        (event as any).totalSeats = (
          event as any
        ).seatingLayout.sections.reduce((total: number, section: any) => {
          // Sections have their own rows/columns that need multiplication
          if (section.rows && section.columns) {
            return total + section.columns * section.rows;
          }
          // Or if they already have seats array, count those
          return total + (section.seats?.length || 0);
        }, 0);
      } else {
        (event as any).totalSeats = 0;
      }
    }
    return event;
  }

  async update(
    id: string,
    updateData: Partial<Event> | any,
  ): Promise<Event | null> {
    try {
      // Convert date to Date object if it's a string
      if (updateData.date && typeof updateData.date === 'string') {
        updateData.date = new Date(updateData.date);
      }

      // Ensure ticketTypes has proper structure if provided
      if (updateData.ticketTypes) {
        updateData.ticketTypes = {
          Free: updateData.ticketTypes.Free || {
            enabled: true,
            price: 0,
          },
          Standard: updateData.ticketTypes.Standard || {
            enabled: false,
            price: 0,
          },
          EarlyBird: updateData.ticketTypes.EarlyBird || {
            enabled: false,
            price: 0,
            limit: 0,
          },
          VIP: updateData.ticketTypes.VIP || {
            enabled: false,
            price: 0,
          },
        };
      }

      console.log('[EventsService] Updating event:', id);
      const updated = await this.eventModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();
      console.log('[EventsService] Event updated successfully:', updated?._id);
      return updated;
    } catch (error) {
      console.error('[EventsService] Error updating event:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    // Fetch the event to get its cover image public_id
    const event = await this.eventModel.findById(id).exec();

    if (event && event.coverImage) {
      let publicId = event.coverImagePublicId;

      // If public_id is not stored, try to extract it from the URL
      // Cloudinary URLs: https://res.cloudinary.com/{cloud}/{type}/upload/{public_id}
      if (!publicId && event.coverImage.includes('cloudinary.com')) {
        try {
          const urlParts = event.coverImage.split('/upload/');
          if (urlParts.length > 1) {
            // Get everything after /upload/ and remove file extension
            publicId = urlParts[1].split('.')[0];
            console.log(
              `[EventsService] Extracted public_id from URL: ${publicId}`,
            );
          }
        } catch (error) {
          console.warn(
            '[EventsService] Could not extract public_id from URL:',
            error,
          );
        }
      }

      if (publicId) {
        // Delete the cover image from Cloudinary
        console.log(
          `[EventsService] Deleting Cloudinary image with public_id: ${publicId}`,
        );
        await this.uploadService.deleteImage(publicId);
      }
    }

    // Delete the event from database
    await this.eventModel.findByIdAndDelete(id).exec();
    console.log(`[EventsService] Event ${id} deleted successfully`);
  }
}
