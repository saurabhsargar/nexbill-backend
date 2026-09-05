import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from 'src/common/pagination/pagination-query.dto';

export const PRODUCT_STATUS_VALUES = [
  'in-stock',
  'low-stock',
  'out-of-stock',
] as const;
export type ProductStatus = (typeof PRODUCT_STATUS_VALUES)[number];

const SORTABLE_FIELDS = [
  'name',
  'price',
  'stock',
  'category',
  'createdAt',
] as const;

export class ProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  search?: string;

  @IsOptional()
  category?: string;

  @IsOptional()
  @IsIn(PRODUCT_STATUS_VALUES)
  status?: ProductStatus;

  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy?: (typeof SORTABLE_FIELDS)[number] = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
