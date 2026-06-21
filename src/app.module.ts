import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule as CronModule } from '@nestjs/schedule';

import { PrismaModule } from './database/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { UsersModule } from './modules/users/users.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { PatientsModule } from './modules/patients/patients.module';
import { FinancialModule } from './modules/financial/financial.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MessagingModule } from './modules/messaging/messaging.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 200,
      },
    ]),
    CronModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ScheduleModule,
    PatientsModule,
    FinancialModule,
    DashboardModule,
    MessagingModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
