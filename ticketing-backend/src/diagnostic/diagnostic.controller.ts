import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('diagnostic')
export class DiagnosticController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
