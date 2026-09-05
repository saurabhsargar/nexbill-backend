import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { BackupRunnerService } from './backup-runner.service';
import { BackupScheduleService } from './backup-schedule.service';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

@Module({
  imports: [PrismaModule],
  controllers: [BackupsController],
  providers: [BackupsService, BackupRunnerService, BackupScheduleService],
})
export class BackupsModule {}
