import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';

export class UpdateBackupScheduleDto {
  @IsIn(['daily', 'weekly', 'monthly'])
  frequency: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'time must be in HH:mm format',
  })
  time: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  retentionCount?: number;
}
