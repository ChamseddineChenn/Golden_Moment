import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { SendGridService } from './sendgrid.service';

@Module({
  providers: [EmailService, SendGridService],
  controllers: [EmailController],
  exports: [EmailService, SendGridService],
})
export class EmailModule {}
