import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientsController],
  providers: [PatientsService],
})
export class PatientsModule {}
