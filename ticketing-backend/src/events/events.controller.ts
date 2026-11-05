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
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { UserType } from '../users/enums/user-type.enum';
import { AppLogger } from '../common/utils/logger';

@Controller('events')
export class EventsController {
  private readonly logger = new AppLogger(EventsController.name);

  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UserTypes(UserType.ORGANIZER, UserType.ADMIN)
  async create(
    @Body() createEventDto: CreateEventDto,
    @GetCurrentUser() currentUser?: any,
  ) {
    this.logger.log('POST /events received', EventsController.name, {
      name: createEventDto.name,
      category: createEventDto.category,
    });
    const result = await this.eventsService.create(createEventDto, currentUser);
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

  @Get('admin/all')
  @UserTypes(UserType.ADMIN)
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

  @Put(':id')
  @UserTypes(UserType.ORGANIZER, UserType.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @GetCurrentUser() currentUser?: any,
  ) {
    this.logger.log('PUT /events/:id', EventsController.name, { id });
    return this.eventsService.update(id, updateEventDto as any, currentUser);
  }

  @Delete(':id')
  @UserTypes(UserType.ORGANIZER, UserType.ADMIN)
  async delete(@Param('id') id: string, @GetCurrentUser() currentUser?: any) {
    this.logger.log('DELETE /events/:id', EventsController.name, { id });
    return this.eventsService.delete(id, currentUser);
  }
}
