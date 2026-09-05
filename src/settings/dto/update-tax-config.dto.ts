import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTaxConfigDto {
  @IsOptional()
  @IsBoolean()
  gstEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  cgstEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sgstEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  igstEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultGstRate?: number;
}
