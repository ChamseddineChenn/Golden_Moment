import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Patch,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { UserType } from './enums/user-type.enum';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';

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

  @Put('me/profile')
  async updateMyProfile(
    @GetCurrentUser('userId') userId: string,
    @Body() updateData: any,
  ) {
    return this.usersService.updateProfile(userId, updateData);
  }
}
