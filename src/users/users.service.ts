import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-users.dto';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async createUser(currentUser: AuthUser, dto: CreateUserDto) {
        // 🔐 ROLE PERMISSION MATRIX
        if (currentUser.role === Role.CASHIER) {
            throw new ForbiddenException('You cannot create users');
        }

        if (
            currentUser.role === Role.MANAGER &&
            dto.role !== Role.CASHIER
        ) {
            throw new ForbiddenException('Managers can only create cashiers');
        }

        // ADMIN can create anyone → no restriction

        const existingUser = await this.prisma.user.findFirst({
            where: {
                email: dto.email,
                organizationId: currentUser.organizationId,
            },
        });

        if (existingUser) {
            throw new BadRequestException('User already exists in this organization');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        return this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                password: hashedPassword,
                role: dto.role,
                organizationId: currentUser.organizationId,
            },
        });
    }

    async findAll(currentUser: AuthUser) {
        return this.prisma.user.findMany({
            where: {
                organizationId: currentUser.organizationId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
}
