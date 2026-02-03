import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-users.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('users')
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Post()
    create(@Body() dto: CreateUserDto) {
        return this.usersService.createUser(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @Get()
    findAll() {
        return this.usersService.findAll();
    }
}
   