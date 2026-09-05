import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  lowStockAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  dailySalesSummary?: boolean;

  @IsOptional()
  @IsBoolean()
  newTransactionAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  systemUpdates?: boolean;
}
