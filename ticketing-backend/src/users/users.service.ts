import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from './enums/role.enum';

@Injectable()
export class UsersService {
  private readonly bcryptRounds: number;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    this.bcryptRounds =
      this.configService.get<number>('security.bcryptRounds') || 12;
  }

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email,
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      this.bcryptRounds,
    );

    const user = new this.userModel({
      email: createUserDto.email,
      password: hashedPassword,
      role: createUserDto.role || Role.USER,
    });

    await user.save();

    return this.findById(user._id.toString());
  }

  async findByEmail(email: string, includePassword = false): Promise<any> {
    const query = this.userModel.findOne({ email: email.toLowerCase() });

    if (includePassword) {
      return query.select('+password').exec();
    }

    return query.exec();
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateRefreshToken(
    userId: string,
    refreshToken: string | null,
  ): Promise<void> {
    const updateData: any = {};

    if (refreshToken) {
      updateData.refreshTokenHash = await bcrypt.hash(
        refreshToken,
        this.bcryptRounds,
      );
    } else {
      updateData.refreshTokenHash = null;
    }

    await this.userModel.findByIdAndUpdate(userId, updateData);
  }

  async validateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<boolean> {
    const user = await this.userModel
      .findById(userId)
      .select('+refreshTokenHash')
      .exec();

    if (!user || !user.refreshTokenHash) {
      return false;
    }

    return bcrypt.compare(refreshToken, user.refreshTokenHash);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { lastLoginAt: new Date() });
  }

  async findAll() {
    return this.userModel.find().exec();
  }
}
