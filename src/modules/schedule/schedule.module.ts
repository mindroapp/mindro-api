import { Module } from '@nestjs/common';

import { MessagingModule } from '../messaging/messaging.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { PublicProfileService } from './public-profile.service';

@Module({
  imports: [MessagingModule],
  controllers: [ScheduleController],
  providers: [ScheduleService, PublicProfileService],
  exports: [ScheduleService, PublicProfileService],
})
export class ScheduleModule {}
