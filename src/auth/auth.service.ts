import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterOrganizationDto } from './dto/register-organization.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  async login(email: string, password: string, organizationSlug: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        organization: {
          slug: organizationSlug,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }


  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async registerOrganization(dto: RegisterOrganizationDto) {
    const {
      organizationName,
      organizationSlug,
      adminName,
      adminEmail,
      password,
    } = dto;

    // 1️⃣ Check if org slug already exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (existingOrg) {
      throw new BadRequestException('Organization already exists');
    }

    // 2️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3️⃣ Transaction (CRITICAL)
    const result = await this.prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug: organizationSlug,
        },
      });

      // Create admin user
      const adminUser = await tx.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          role: 'ADMIN',
          organizationId: organization.id,
        },
      });

      return { organization, adminUser };
    });

    return {
      message: 'Organization registered successfully',
      organizationId: result.organization.id,
    };
  }

}
