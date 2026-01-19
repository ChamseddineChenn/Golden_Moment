import { Controller, Get, Res } from '@nestjs/common';
import { AppLogger } from '../common/utils/logger';
import type { Response } from 'express';

@Controller('diagnostic')
export class DiagnosticController {
  private readonly logger = new AppLogger(DiagnosticController.name);

  @Get('health')
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-event')
  async testEvent(@Res() res: Response) {
    try {
      const response = await fetch(
        'http://localhost:3002/events/696e3fd28fe69b7a1766e940',
        {
          method: 'GET',
        },
      );
      const data = await response.json();
      return res.json({
        message: 'Event retrieved from API',
        hasData: !!data,
        hasDataField: !!data?.data,
        hasTicketTypes: !!data?.data?.ticketTypes,
        eventName: data?.data?.name,
        ticketTypesCount: data?.data?.ticketTypes
          ? Object.keys(data.data.ticketTypes).length
          : 0,
        ticketTypesList: data?.data?.ticketTypes
          ? Object.keys(data.data.ticketTypes)
          : null,
      });
    } catch (err) {
      this.logger.error(
        'Error in diagnostic/test-event',
        DiagnosticController.name,
        { error: err },
      );
      return res.status(500).json({ error: String(err) });
    }
  }
}
