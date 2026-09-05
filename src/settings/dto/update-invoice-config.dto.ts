import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateInvoiceConfigDto {
  @IsOptional()
  prefix?: string;

  @IsOptional()
  footerNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  startingNumber?: number;
}
