import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateSecuritySettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  sessionTimeoutMinutes: number;
}
