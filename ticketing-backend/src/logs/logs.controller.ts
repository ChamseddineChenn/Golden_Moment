import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
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

    const logs = await this.logsService.findAll(filters);
    
    return {
      success: true,
      count: logs.length,
      data: logs,
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
      data: logs,
    };
  }

  /**
   * GET /logs/user/:userId?limit=50
   * Get logs for a specific user
   */
  @Get('user/:userId')
  async getLogsByUser(
    @Param('userId') userId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const logs = await this.logsService.findByUserId(userId, limit);
    
    return {
      success: true,
      count: logs.length,
      data: logs,
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
      data: logs,
    };
  }

  /**
   * GET /logs/statistics?startDate=2024-01-01&endDate=2024-12-31
   * Get log statistics
   */
  @Get('statistics')
  async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    const stats = await this.logsService.getStatistics(start, end);
    
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * DELETE /logs/cleanup?daysToKeep=90
   * Delete old logs (admin only)
   */
  @Delete('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupOldLogs(
    @Query('daysToKeep', new DefaultValuePipe(90), ParseIntPipe)
    daysToKeep: number,
  ) {
    const deletedCount = await this.logsService.deleteOldLogs(daysToKeep);
    
    return {
      success: true,
      message: `Deleted ${deletedCount} old log entries`,
      deletedCount,
    };
  }

  /**
   * GET /logs/actions
   * Get list of all available log actions
   */
  @Get('actions')
  getAvailableActions() {
    return {
      success: true,
      data: Object.values(LogAction),
    };
  }
}
