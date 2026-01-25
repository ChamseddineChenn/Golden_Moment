import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Log, LogDocument, LogAction } from './log.schema';

export interface CreateLogDto {
  action: LogAction;
  userId?: string | Types.ObjectId;
  userEmail?: string;
  eventId?: string;
  eventName?: string;
  ticketId?: string;
  ticketName?: string;
  performedBy?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class LogsService {
  constructor(
    @InjectModel(Log.name) private logModel: Model<LogDocument>,
  ) {}

  /**
   * Create a new log entry
   */
  async createLog(
    action: LogAction,
    data: Partial<CreateLogDto> = {},
  ): Promise<LogDocument> {
    try {
      const logEntry = new this.logModel({
        action,
        userId: data.userId,
        userEmail: data.userEmail,
        eventId: data.eventId,
        eventName: data.eventName,
        ticketId: data.ticketId,
        ticketName: data.ticketName,
        performedBy: data.performedBy,
        metadata: data.metadata || {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        timestamp: new Date(),
      });

      return await logEntry.save();
    } catch (error) {
      console.error('Failed to create log:', error);
      // Don't throw - logging should not break the application
      return null;
    }
  }

  /**
   * Get all logs with optional filters
   */
  async findAll(filters: {
    action?: LogAction;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    skip?: number;
  } = {}): Promise<LogDocument[]> {
    const query: any = {};

    if (filters.action) {
      query.action = filters.action;
    }

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.timestamp.$lte = filters.endDate;
      }
    }

    return this.logModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(filters.limit || 100)
      .skip(filters.skip || 0)
      .populate('userId', 'email userType')
      .exec();
  }

  /**
   * Get logs for a specific user
   */
  async findByUserId(userId: string, limit = 50): Promise<LogDocument[]> {
    return this.logModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get logs by action type
   */
  async findByAction(action: LogAction, limit = 100): Promise<LogDocument[]> {
    return this.logModel
      .find({ action })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(limit = 50): Promise<LogDocument[]> {
    return this.logModel
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('userId', 'email userType')
      .exec();
  }

  /**
   * Delete old logs (cleanup)
   */
  async deleteOldLogs(daysToKeep = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.logModel.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    return result.deletedCount;
  }

  /**
   * Get log statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<any> {
    const matchStage: any = {};

    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = startDate;
      if (endDate) matchStage.timestamp.$lte = endDate;
    }

    const stats = await this.logModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return stats;
  }
}
