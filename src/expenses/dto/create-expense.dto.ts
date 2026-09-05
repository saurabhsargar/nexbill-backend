import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsNotEmpty()
  category: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  note?: string;

  @IsOptional()
  @IsISO8601()
  incurredAt?: string;
}
