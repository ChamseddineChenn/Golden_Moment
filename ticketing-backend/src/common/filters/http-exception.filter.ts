import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '../utils/logger';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new AppLogger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: exceptionResponse?.message || 'Internal server error',
      ...(status === HttpStatus.INTERNAL_SERVER_ERROR && {
        error: 'Internal Server Error',
      }),
    };

    this.logger.error(
      `${request.method} ${request.url}`,
      'HttpExceptionFilter',
      errorResponse,
    );

    response.status(status).json(errorResponse);
  }
}
