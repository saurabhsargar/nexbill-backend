import { ProductStatus } from './dto/product-query.dto';

/**
 * Single implementation of the in-stock/low-stock/out-of-stock rule, used
 * everywhere a product is serialized so status can never drift from stock/minStock.
 */
export function computeStatus(stock: number, minStock: number): ProductStatus {
  if (stock === 0) return 'out-of-stock';
  if (stock <= minStock) return 'low-stock';
  return 'in-stock';
}
