import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event } from './event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { SeatsService } from './seats.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<Event>,
    private seatsService: SeatsService,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    // Ensure category is set, default to 'Concert' if not provided
    const eventData = {
      ...createEventDto,
      category: createEventDto.category || 'Concert',
    };

    console.log(
      '[EventsService] Creating event with category:',
      eventData.category,
    );

    const createdEvent = new this.eventModel(eventData);
    const savedEvent = await createdEvent.save();

    console.log(
      '[EventsService] Event saved with category:',
      savedEvent.category,
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
  }

  async findAll(): Promise<Event[]> {
    const events = await this.eventModel.find({ isActive: true }).exec();
    console.log(
      '[EventsService] findAll returning events:',
      events.map((e) => ({ id: e._id, name: e.name, category: e.category })),
    );
    return events;
  }

  async findById(id: string): Promise<Event | null> {
    return this.eventModel.findById(id).exec();
  }

  async update(id: string, updateData: Partial<Event>): Promise<Event | null> {
    return this.eventModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string): Promise<void> {
    await this.eventModel.findByIdAndDelete(id).exec();
  }
}
