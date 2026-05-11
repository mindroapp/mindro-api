import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { Request, Response, NextFunction } from 'express';

import * as swaggerStats from 'swagger-stats';

type SwaggerStatsModule = {
  getMiddleware: (config: {
    uriPath: string;
    authentication: boolean;
    onAuthenticate: (req: unknown, username: string, password: string) => boolean;
  }) => (req: unknown, res: unknown, next: () => void) => void;
};

const swaggerStatsModule = swaggerStats as unknown as SwaggerStatsModule;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase body size limit to support base64-encoded file attachments (up to 10 MB per file)
  app.use(require('express').json({ limit: '50mb' }));
  app.use(require('express').urlencoded({ limit: '50mb', extended: true }));

  app.setGlobalPrefix('api');

  const defaultOrigins = [
    'http://localhost:8080',
    'http://localhost:5173',
    'https://api.mindro.com.br',
    'https://mindro.com.br',
    'https://www.mindro.com.br',
  ];

  const envOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, Origin, X-Requested-With',
      );
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    return next();
  });

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS bloqueado para origem: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(
    swaggerStatsModule.getMiddleware({
      uriPath: '/swagger-stats',
      authentication: true,
      onAuthenticate: (req, username, password) =>
        username === 'admin@kestra.com' && password === process.env.JWT_SECRET,
    }),
  );

  await app.listen(process.env.PORT);
}
void bootstrap();
