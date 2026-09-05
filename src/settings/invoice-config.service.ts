import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { PrismaService } from 'src/database/prisma.service';
import { UpdateInvoiceConfigDto } from './dto/update-invoice-config.dto';

@Injectable()
export class InvoiceConfigService {
  constructor(private prisma: PrismaService) {}

  get(user: AuthUser) {
    return this.prisma.invoiceConfig.upsert({
      where: { organizationId: user.organizationId },
      update: {},
      create: { organizationId: user.organizationId },
    });
  }

  async update(user: AuthUser, dto: UpdateInvoiceConfigDto) {
    const { startingNumber, ...rest } = dto;

    if (startingNumber !== undefined) {
      const invoiceCount = await this.prisma.invoice.count({
        where: { organizationId: user.organizationId },
      });
      if (invoiceCount > 0) {
        throw new BadRequestException(
          'Starting number can only be set before any invoice has been created',
        );
      }
    }

    return this.prisma.invoiceConfig.upsert({
      where: { organizationId: user.organizationId },
      update: {
        ...rest,
        ...(startingNumber !== undefined ? { nextNumber: startingNumber } : {}),
      },
      create: {
        ...rest,
        organizationId: user.organizationId,
        ...(startingNumber !== undefined ? { nextNumber: startingNumber } : {}),
      },
    });
  }
}
