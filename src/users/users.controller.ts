import { Controller, Post, Body, UseGuards, Get, Patch, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-users.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as authUserType from 'src/auth/types/auth-user.type';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Post()
    create(
        @CurrentUser() user: authUserType.AuthUser,
        @Body() dto: CreateUserDto,
    ) {
        return this.usersService.createUser(user, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'MANAGER')
    @Get()
    findAll(@CurrentUser() user: authUserType.AuthUser) {
        return this.usersService.findAll(user);
    }

    @Patch(':id/role')
    updateRole(
        @CurrentUser() user: authUserType.AuthUser,
        @Param('id') id: string,
        @Body() dto: UpdateUserRoleDto,
    ) {
        return this.usersService.updateUserRole(user, id, dto.role);
    }

    @Patch(':id/deactivate')
    deactivate(
        @CurrentUser() user: authUserType.AuthUser,
        @Param('id') id: string,
    ) {
        return this.usersService.deactivateUser(user, id);
    }
}
