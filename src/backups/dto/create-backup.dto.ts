import { IsEnum } from 'class-validator';
import { BackupType } from '@prisma/client';

export class CreateBackupDto {
  @IsEnum(BackupType)
  type: BackupType;
}
