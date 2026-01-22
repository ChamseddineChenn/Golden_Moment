import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Patch,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { UserType } from './enums/user-type.enum';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import {
  UpdateBaseProfileDto,
  UpdateOrganizerProfileDto,
  UpdateAdminProfileDto,
} from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UserTypes(UserType.ADMIN)
  async findAll() {
    const users = await this.usersService.findAll();
    return {
      success: true,
      data: users,
    };
  }

  @Get('organizers')
  @UserTypes(UserType.ADMIN)
  async findAllOrganizers() {
    const organizers = await this.usersService.findAllOrganizers();
    return {
      success: true,
      data: organizers,
    };
  }

  @Patch('organizers/:id/verify')
  @UserTypes(UserType.ADMIN)
  async verifyOrganizer(@Param('id') id: string) {
    return this.usersService.verifyOrganizer(id);
  }

  @Patch(':id/deactivate')
  @UserTypes(UserType.ADMIN)
  async deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }

  @Delete(':id')
  @UserTypes(UserType.ADMIN)
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @Get('me/profile')
  async getMyProfile(@GetCurrentUser('userId') userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      success: true,
      data: user,
    };
  }

  @Patch('me/profile')
  async updateMyProfile(
    @GetCurrentUser('userId') userId: string,
    @GetCurrentUser('userType') userType: string,
    @Body()
    updateData:
      | UpdateBaseProfileDto
      | UpdateOrganizerProfileDto
      | UpdateAdminProfileDto,
  ) {
    // Validate DTO based on userType
    if (userType === UserType.ORGANIZER) {
      // TypeScript will validate UpdateOrganizerProfileDto fields
      return this.usersService.updateProfile(userId, userType, updateData);
    } else if (userType === UserType.ADMIN) {
      // Admins can only update base fields (email)
      return this.usersService.updateProfile(userId, userType, updateData);
    } else {
      // Regular users can only update email
      if (
        Object.keys(updateData).length > 1 ||
        (Object.keys(updateData).length === 1 && !updateData.email)
      ) {
        throw new BadRequestException(
          'Regular users can only update their email',
        );
      }
      return this.usersService.updateProfile(userId, userType, updateData);
    }
  }
}
