import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BackupStatus } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { PaginatedResult } from 'src/common/pagination/paginated-result.interface';
import { PaginationQueryDto } from 'src/common/pagination/pagination-query.dto';
import { PrismaService } from 'src/database/prisma.service';
import { BackupRunnerService } from './backup-runner.service';
import { CreateBackupDto } from './dto/create-backup.dto';

@Injectable()
export class BackupsService {
  constructor(
    private prisma: PrismaService,
    private backupRunner: BackupRunnerService,
  ) {}

  async create(user: AuthUser, dto: CreateBackupDto) {
    const backup = await this.prisma.backup.create({
      data: { type: dto.type, organizationId: user.organizationId },
    });

    // Fire-and-forget: the caller gets the PENDING row immediately, status
    // updates land asynchronously as the job progresses.
    void this.backupRunner.run(backup.id);

    return backup;
  }

  async findAll(
    user: AuthUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const { page = 1, pageSize = 20 } = query;
    const where = { organizationId: user.organizationId };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.backup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        omit: { filePath: true },
      }),
      this.prisma.backup.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(user: AuthUser, id: string) {
    const backup = await this.prisma.backup.findFirst({
      where: { id, organizationId: user.organizationId },
      omit: { filePath: true },
    });
    if (!backup) throw new NotFoundException('Backup not found');
    return backup;
  }

  async download(user: AuthUser, id: string, res: Response) {
    const backup = await this.prisma.backup.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!backup) throw new NotFoundException('Backup not found');
    if (backup.status !== BackupStatus.COMPLETED || !backup.filePath) {
      throw new BadRequestException('Backup is not ready for download');
    }

    res.download(backup.filePath, `${backup.id}.dump`);
  }

  async restore(user: AuthUser, id: string) {
    const backup = await this.prisma.backup.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!backup) throw new NotFoundException('Backup not found');
    if (backup.status !== BackupStatus.COMPLETED || !backup.filePath) {
      throw new BadRequestException('Backup is not ready for restore');
    }

    await this.backupRunner.restore(backup.filePath);
    return { message: 'Database restored successfully' };
  }
}
