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
  constructor(@InjectModel(Log.name) private logModel: Model<LogDocument>) {}

  /**
   * Create a new log entry for admin actions (EVENT and TICKET actions only)
   */
  async createLog(
    action: LogAction,
    data: Partial<CreateLogDto> = {},
  ): Promise<LogDocument> {
    try {
      // CRITICAL FIX: Block EVENT_UPDATED logs from automatic system updates (with no user info)
      // These are system field updates (soldTickets, earlyBirdCount) from ticket purchases
      // Only block if: (1) no currentUser (automatic), AND (2) only system fields changed
      if (action === LogAction.EVENT_UPDATED && data.metadata) {
        const systemOnlyFields = ['soldTickets', 'earlyBirdCount'];
        const metadataKeys = Array.isArray(data.metadata)
          ? data.metadata
          : Object.keys(data.metadata);

        const isSystemFieldsOnly =
          metadataKeys.length > 0 &&
          metadataKeys.every((key: string) => systemOnlyFields.includes(key));

        // Only block automatic updates: if NO user info (performedBy = 'Unknown') AND only system fields
        const isAutomaticUpdate =
          (data.performedBy === 'Unknown' || !data.userEmail) &&
          isSystemFieldsOnly;

        if (isAutomaticUpdate) {
          return null; // Don't create log for automatic system updates
        }
      }

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
  async findAll({
    filters = {},
  }: {
    filters?: {
      action?: LogAction;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      skip?: number;
    };
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
}
