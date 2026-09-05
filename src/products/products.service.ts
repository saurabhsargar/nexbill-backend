import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { stringify } from 'csv-stringify/sync';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { PaginatedResult } from 'src/common/pagination/paginated-result.interface';
import { PrismaService } from 'src/database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { computeStatus } from './products.util';

const BASE_SELECT = {
  id: true,
  name: true,
  sku: true,
  category: true,
  price: true,
  stock: true,
  minStock: true,
  gstRate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

const FULL_SELECT = {
  ...BASE_SELECT,
  cost: true,
} satisfies Prisma.ProductSelect;

type ProductRow = { stock: number; minStock: number } & Record<string, unknown>;

function withStatus<T extends ProductRow>(product: T) {
  return { ...product, status: computeStatus(product.stock, product.minStock) };
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private selectFor(user: AuthUser) {
    return user.role === Role.CASHIER ? BASE_SELECT : FULL_SELECT;
  }

  async findAll(
    user: AuthUser,
    query: ProductQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const {
      search,
      category,
      status,
      sortBy = 'createdAt',
      sortDir = 'desc',
      page = 1,
      pageSize = 20,
    } = query;

    const select = this.selectFor(user);
    const where: Prisma.ProductWhereInput = {
      organizationId: user.organizationId,
      isActive: true,
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = {
      [sortBy]: sortDir,
    } as Prisma.ProductOrderByWithRelationInput;

    if (status) {
      // status is derived from stock vs minStock, which Prisma can't compare
      // directly in a `where` clause -- filter in memory over the already
      // org/search/category-scoped set (fine at SMB catalog sizes).
      const all = await this.prisma.product.findMany({
        where,
        select,
        orderBy,
      });
      const filtered = all.filter(
        (p) => computeStatus(p.stock, p.minStock) === status,
      );
      const start = (page - 1) * pageSize;
      return {
        data: filtered.slice(start, start + pageSize).map(withStatus),
        total: filtered.length,
        page,
        pageSize,
      };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data: rows.map(withStatus), total, page, pageSize };
  }

  async findOne(user: AuthUser, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId: user.organizationId, isActive: true },
      select: this.selectFor(user),
    });
    if (!product) throw new NotFoundException('Product not found');
    return withStatus(product);
  }

  async lookupByBarcode(user: AuthUser, barcode: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        sku: barcode,
        organizationId: user.organizationId,
        isActive: true,
      },
      select: this.selectFor(user),
    });
    if (!product) throw new NotFoundException('Product not found');
    return withStatus(product);
  }

  async getCategories(user: AuthUser) {
    const groups = await this.prisma.product.groupBy({
      by: ['category'],
      where: { organizationId: user.organizationId, isActive: true },
      _count: { _all: true },
    });
    return groups.map((g) => ({ name: g.category, count: g._count._all }));
  }

  async create(user: AuthUser, dto: CreateProductDto) {
    const gstRate =
      dto.gstRate ?? (await this.resolveDefaultGstRate(user.organizationId));
    try {
      const product = await this.prisma.product.create({
        data: { ...dto, gstRate, organizationId: user.organizationId },
        select: FULL_SELECT,
      });
      return withStatus(product);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A product with this SKU already exists');
      }
      throw err;
    }
  }

  private async resolveDefaultGstRate(organizationId: string): Promise<number> {
    const taxConfig = await this.prisma.taxConfig.findUnique({
      where: { organizationId },
      select: { defaultGstRate: true },
    });
    return taxConfig ? Number(taxConfig.defaultGstRate) : 18;
  }

  async update(user: AuthUser, id: string, dto: UpdateProductDto) {
    await this.assertExists(user, id);
    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: dto,
        select: FULL_SELECT,
      });
      return withStatus(product);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A product with this SKU already exists');
      }
      throw err;
    }
  }

  async remove(user: AuthUser, id: string) {
    await this.assertExists(user, id);
    const product = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      select: FULL_SELECT,
    });
    return withStatus(product);
  }

  async adjustStock(user: AuthUser, id: string, dto: StockAdjustmentDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id, organizationId: user.organizationId, isActive: true },
      });
      if (!product) throw new NotFoundException('Product not found');

      const newStock = product.stock + dto.delta;
      if (newStock < 0) {
        throw new BadRequestException(
          'Stock adjustment would result in negative stock',
        );
      }

      const updated = await tx.product.update({
        where: { id },
        data: { stock: newStock },
        select: FULL_SELECT,
      });
      await tx.stockAdjustment.create({
        data: {
          productId: id,
          userId: user.id,
          delta: dto.delta,
          reason: dto.reason,
        },
      });

      return withStatus(updated);
    });
  }

  async exportCsv(user: AuthUser): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: FULL_SELECT,
      orderBy: { name: 'asc' },
    });

    const rows = products.map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      price: p.price.toString(),
      cost: p.cost.toString(),
      stock: p.stock,
      minStock: p.minStock,
      gstRate: p.gstRate.toString(),
      status: computeStatus(p.stock, p.minStock),
    }));

    return stringify(rows, { header: true });
  }

  private async assertExists(user: AuthUser, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId: user.organizationId, isActive: true },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
  }
}
