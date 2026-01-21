import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { AppLogger } from '../common/utils/logger';
import { Public } from '../auth/decorators/public.decorator';

@Controller('upload')
export class UploadController {
  private readonly logger = new AppLogger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  @Public()
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      this.logger.warn('No file provided in request', UploadController.name);
      throw new BadRequestException('No file provided');
    }

    this.logger.log(
      `Image upload request: ${file.originalname}`,
      UploadController.name,
    );

    const result = await this.uploadService.uploadImage(file);

    return {
      success: true,
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  }

  @Public()
  @Post('delete-image')
  async deleteImage(@Body('publicId') publicId: string) {
    if (!publicId) {
      this.logger.warn('publicId not provided', UploadController.name);
      throw new BadRequestException('publicId is required');
    }

    this.logger.log(`Image delete request: ${publicId}`, UploadController.name);

    await this.uploadService.deleteImage(publicId);

    return {
      success: true,
      message: 'Image deleted successfully',
    };
  }
}
