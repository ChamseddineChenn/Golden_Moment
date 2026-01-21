import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Public } from '../auth/decorators/public.decorator';
import { AppLogger } from '../common/utils/logger';

@Controller('events')
export class EventsController {
  private readonly logger = new AppLogger(EventsController.name);

  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Post()
  async create(@Body() createEventDto: CreateEventDto) {
    this.logger.log('POST /events received', EventsController.name, {
      name: createEventDto.name,
      category: createEventDto.category,
    });
    const result = await this.eventsService.create(createEventDto);
    this.logger.log('Event created successfully', EventsController.name, {
      id: result._id.toString(),
    });
    return result;
  }

  @Public()
  @Get()
  async findAll() {
    // Public endpoint - only show published events
    this.logger.log('GET /events (published)', EventsController.name);
    return this.eventsService.findAllPublished();
  }

  @Public()
  @Get('admin/all')
  async findAllAdmin() {
    // Admin endpoint - show all events including drafts
    this.logger.log('GET /events/admin/all', EventsController.name);
    return this.eventsService.findAllAdmin();
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    this.logger.log('GET /events/:id', EventsController.name, { id });
    return this.eventsService.findById(id);
  }

  @Public()
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    this.logger.log('PUT /events/:id', EventsController.name, { id });
    return this.eventsService.update(id, updateEventDto as any);
  }

  @Public()
  @Delete(':id')
  async delete(@Param('id') id: string) {
    this.logger.log('DELETE /events/:id', EventsController.name, { id });
    return this.eventsService.delete(id);
  }
}
