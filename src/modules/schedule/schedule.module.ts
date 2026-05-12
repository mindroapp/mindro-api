import { Module } from '@nestjs/common';

import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { PublicProfileService } from './public-profile.service';

@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService, PublicProfileService],
  exports: [ScheduleService, PublicProfileService],
})
export class ScheduleModule {}
