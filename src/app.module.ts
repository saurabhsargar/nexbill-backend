import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { BusinessModule } from './business/business.module';
import { SettingsModule } from './settings/settings.module';
import { SystemModule } from './system/system.module';
import { BackupsModule } from './backups/backups.module';
import { ExportsModule } from './exports/exports.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    CustomersModule,
    InvoicesModule,
    ExpensesModule,
    DashboardModule,
    ReportsModule,
    BusinessModule,
    SettingsModule,
    SystemModule,
    BackupsModule,
    ExportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
