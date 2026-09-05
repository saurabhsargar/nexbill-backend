import { IsIn, IsOptional } from 'class-validator';
import type { TrendRange } from './trend-window.util';

const RANGE_VALUES: TrendRange[] = ['daily', 'weekly', 'monthly'];

export class TrendRangeQueryDto {
  @IsOptional()
  @IsIn(RANGE_VALUES)
  range?: TrendRange = 'daily';
}
