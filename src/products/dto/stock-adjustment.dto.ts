import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, NotEquals } from 'class-validator';

export class StockAdjustmentDto {
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  delta: number;

  @IsNotEmpty()
  reason: string;
}
