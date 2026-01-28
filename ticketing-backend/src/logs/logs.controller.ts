import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Param,
} from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogAction } from './log.schema';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * GET /logs?limit=100&skip=0&action=EVENT_CREATE&userId=123&startDate=2024-01-01&endDate=2024-12-31
   * Get all logs with optional filters
   */
  @Get()
  async getAllLogs(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('action') action?: LogAction,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: any = { limit, skip };

    if (action) {
      filters.action = action;
    }

    if (userId) {
      filters.userId = userId;
    }

    if (startDate) {
      filters.startDate = new Date(startDate);
    }

    if (endDate) {
      filters.endDate = new Date(endDate);
    }

    const logs = await this.logsService.findAll({ filters });

    return {
      success: true,
      count: logs.length,
      logs: logs,
    };
  }

  /**
   * GET /logs/recent?limit=50
   * Get recent logs
   */
  @Get('recent')
  async getRecentLogs(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const logs = await this.logsService.getRecentLogs(limit);

    return {
      success: true,
      count: logs.length,
      logs: logs,
    };
  }

  /**
   * GET /logs/action/:action?limit=100
   * Get logs by action type
   */
  @Get('action/:action')
  async getLogsByAction(
    @Param('action') action: LogAction,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    const logs = await this.logsService.findByAction(action, limit);

    return {
      success: true,
      count: logs.length,
      logs: logs,
    };
  }
}
