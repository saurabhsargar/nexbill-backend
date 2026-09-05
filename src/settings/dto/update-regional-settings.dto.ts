import { IsOptional } from 'class-validator';

export class UpdateRegionalSettingsDto {
  @IsOptional()
  language?: string;

  @IsOptional()
  currency?: string;

  @IsOptional()
  dateFormat?: string;
}
