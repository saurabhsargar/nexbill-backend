import { Injectable } from '@nestjs/common';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { buildDateRangeFilter } from 'src/common/date/date-range.util';
import { PrismaService } from 'src/database/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  findAll(user: AuthUser, query: ExpenseQueryDto) {
    const incurredAt = buildDateRangeFilter(query.from, query.to);
    return this.prisma.expense.findMany({
      where: {
        organizationId: user.organizationId,
        ...(incurredAt ? { incurredAt } : {}),
      },
      orderBy: { incurredAt: 'desc' },
    });
  }

  create(user: AuthUser, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        category: dto.category,
        amount: dto.amount,
        note: dto.note,
        incurredAt: dto.incurredAt ? new Date(dto.incurredAt) : undefined,
        organizationId: user.organizationId,
      },
    });
  }
}
