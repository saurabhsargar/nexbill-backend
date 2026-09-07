<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="90" alt="NestJS" />
</p>

<h1 align="center">NexBill</h1>
<p align="center">A multi-tenant invoicing &amp; billing backend built with NestJS, Prisma, and PostgreSQL.</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-database-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/license-UNLICENSED-lightgrey" alt="License" />
</p>

---

## Overview

NexBill is a REST API for organizations to manage products, customers, invoices, expenses, and business reporting from a single backend. It supports role-based access control, automated backups, and data export in multiple formats (PDF, Excel, CSV).

## Features

- **Auth** — JWT-based authentication with role-scoped access (`ADMIN`, `MANAGER`, `CASHIER`)
- **Products** — catalog management with stock adjustments
- **Customers** — customer directory and relationship data
- **Invoices** — invoice creation, line items, tax calculation, and configuration
- **Expenses** — expense tracking per organization
- **Dashboard & Reports** — aggregated business metrics and reporting endpoints
- **Business & Settings** — business profile, tax config, regional settings, notification preferences
- **Exports** — generate PDF (`pdfkit`), Excel (`exceljs`), and CSV (`csv-stringify`) documents
- **Backups** — scheduled and on-demand database backups
- **System** — health/system info via `systeminformation`

## Tech Stack

| Layer          | Technology                          |
|----------------|--------------------------------------|
| Framework      | [NestJS 11](https://nestjs.com)      |
| Language       | TypeScript                           |
| ORM / Database | [Prisma](https://prisma.io) + PostgreSQL |
| Auth           | JWT (`@nestjs/jwt`, `passport-jwt`)  |
| Validation     | `class-validator`, `class-transformer` |
| Documents      | `pdfkit`, `exceljs`, `csv-stringify` |
| Testing        | Jest, Supertest                      |

## Project Structure

```
src/
├── auth/          # JWT auth, guards, roles, strategies
├── users/         # User management
├── business/      # Business profile
├── products/      # Product catalog & stock
├── customers/      # Customer records
├── invoices/      # Invoicing & line items
├── expenses/      # Expense tracking
├── dashboard/     # Aggregated metrics
├── reports/       # Reporting endpoints
├── settings/      # Tax, regional & notification settings
├── exports/       # PDF / Excel / CSV generation
├── backups/       # Backup jobs & schedules
├── system/        # System/health info
├── database/      # Prisma module & client
└── common/        # Shared utilities (pagination, date, tax-calc)
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL instance

### Setup

```bash
# install dependencies
npm install

# configure environment
cp .env.example .env   # then fill in the values below

# run database migrations
npx prisma migrate dev

# start in watch mode
npm run start:dev
```

### Environment Variables

| Variable          | Description                          |
|--------------------|---------------------------------------|
| `DATABASE_URL`     | PostgreSQL connection string          |
| `JWT_SECRET`        | Secret used to sign JWT tokens        |
| `JWT_EXPIRES_IN`    | Token expiry (e.g. `1d`)              |
| `PORT`              | API port                              |
| `REDIS_HOST`        | Redis host                            |
| `REDIS_PORT`        | Redis port                            |

## Available Scripts

```bash
npm run start:dev     # development with hot reload
npm run start:prod     # production build
npm run build           # compile TypeScript
npm run lint             # lint & autofix
npm run format           # format with Prettier
npm run test              # unit tests
npm run test:e2e         # end-to-end tests
npm run test:cov         # coverage report
```

## Database

Schema is managed with Prisma (`prisma/schema.prisma`). Core models include `User`, `Organization`, `Product`, `StockAdjustment`, `Customer`, `Invoice`, `InvoiceItem`, `Expense`, `BusinessProfile`, `TaxConfig`, `RegionalSettings`, and `Backup`.

```bash
npx prisma studio        # browse data
npx prisma migrate dev   # apply migrations
npx prisma generate      # regenerate client
```

## License

UNLICENSED — private/proprietary project.
