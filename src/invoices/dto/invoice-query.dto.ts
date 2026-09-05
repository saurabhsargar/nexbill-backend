import { IsISO8601, IsOptional } from 'class-validator';
import { PaginationQueryDto } from 'src/common/pagination/pagination-query.dto';

export class InvoiceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
