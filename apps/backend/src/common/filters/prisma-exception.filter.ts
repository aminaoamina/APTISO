import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Database errors caused by the request itself become client errors instead of a 500. */
const KNOWN: Record<string, { status: HttpStatus; error: string; message: string }> = {
  P2023: { status: HttpStatus.BAD_REQUEST, error: 'Bad Request', message: 'Invalid identifier' },
  P2025: { status: HttpStatus.NOT_FOUND, error: 'Not Found', message: 'Record not found' },
  P2002: { status: HttpStatus.CONFLICT, error: 'Conflict', message: 'This record already exists' },
  P2003: { status: HttpStatus.CONFLICT, error: 'Conflict', message: 'This record is linked to another record' },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const known = KNOWN[exception.code];
    if (!known || host.getType() !== 'http') return super.catch(exception, host);
    const { status, error, message } = known;
    host.switchToHttp().getResponse<Response>().status(status).json({ statusCode: status, message, error });
  }
}
