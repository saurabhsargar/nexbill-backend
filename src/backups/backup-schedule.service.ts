import { Injectable } from '@nestjs/common';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { PrismaService } from 'src/database/prisma.service';
import { UpdateBackupScheduleDto } from './dto/update-backup-schedule.dto';

const DEFAULT_SCHEDULE = { frequency: 'daily', time: '02:00' };

@Injectable()
export class BackupScheduleService {
  constructor(private prisma: PrismaService) {}

  get(user: AuthUser) {
    return this.prisma.backupSchedule.upsert({
      where: { organizationId: user.organizationId },
      update: {},
      create: { organizationId: user.organizationId, ...DEFAULT_SCHEDULE },
    });
  }

  update(user: AuthUser, dto: UpdateBackupScheduleDto) {
    return this.prisma.backupSchedule.upsert({
      where: { organizationId: user.organizationId },
      update: dto,
      create: { ...dto, organizationId: user.organizationId },
    });
  }
}
