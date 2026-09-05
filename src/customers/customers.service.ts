import { Injectable } from '@nestjs/common';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { PrismaService } from 'src/database/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

const SEARCH_LIMIT = 20;

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  search(user: AuthUser, search?: string) {
    return this.prisma.customer.findMany({
      where: {
        organizationId: user.organizationId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: SEARCH_LIMIT,
    });
  }

  create(user: AuthUser, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: { ...dto, organizationId: user.organizationId },
    });
  }
}
