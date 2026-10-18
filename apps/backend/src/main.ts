import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'deny' },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use(cookieParser());

  // Serve uploaded files (avatars) statically
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // CORS - credentials enabled for HttpOnly cookies
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-csrf-token'],
    exposedHeaders: ['X-CSRF-Token', 'Set-Cookie'],
    maxAge: 3600,
  });

  app.setGlobalPrefix(process.env.API_PREFIX || 'api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('APTISO API')
    .setDescription(
      'API for the APTISO ISO 27001 compliance management platform. ' +
        'Supports user registration, email verification, login, projects, ' +
        'and compliance workflows.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('Authentication', 'Registration, login, password reset, sessions')
    .addTag('Security', 'CSRF token endpoint')
    .addTag('Health', 'Health check')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);

  console.log(`🚀 APTISO API running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
