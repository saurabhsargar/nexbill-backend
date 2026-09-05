# NexBill — Backend API Spec (replacing frontend mock data)

Audience: `nexbill-backend` (NestJS + Prisma + PostgreSQL). This document was produced by reading every dashboard page in `nexbill-app` and the existing `auth`/`users` modules, and lists every endpoint needed to replace mock/hardcoded frontend data with real, persisted data.

Only `auth` and `users` exist today. Everything below is new.

## Table of contents

1. [Conventions to follow (from the existing `auth`/`users` modules)](#1-conventions-to-follow)
2. [Open decisions needed before/while building (read this first)](#2-open-decisions-needed)
3. [Prisma schema additions](#3-prisma-schema-additions)
4. [Phase 1 — Core transactional: Products, Customers, Invoices](#4-phase-1--core-transactional)
5. [Phase 2 — Analytics: Dashboard, Reports](#5-phase-2--analytics)
6. [Phase 3 — Configuration: Business profile, Tax, Invoice numbering, Regional](#6-phase-3--configuration)
7. [Phase 4 — Personal/account: notifications, security, password](#7-phase-4--personalaccount)
8. [Phase 5 — Ops/Utilities (lower priority)](#8-phase-5--opsutilities-lower-priority)
9. [Explicitly out of scope / cosmetic-only](#9-explicitly-out-of-scope--cosmetic-only)

---

## 1. Conventions to follow

Extracted from `src/auth/*` and `src/users/*`. New modules should match these unless a deviation is called out in [§2](#2-open-decisions-needed).

**Module layout** (one folder per resource, mirrors `src/users/`):
```
src/<resource>/
  dto/
    create-<resource>.dto.ts
    update-<resource>.dto.ts
  <resource>.controller.ts
  <resource>.service.ts
  <resource>.module.ts
```
Register the module in `app.module.ts`'s `imports` array (flat list, no versioning/prefix).

**Auth/roles pattern** — copy verbatim from `users.controller.ts`:
```ts
@Controller('products')
@UseGuards(JwtAuthGuard)              // class-level: every route requires a valid JWT
export class ProductsController {
  @UseGuards(JwtAuthGuard, RolesGuard)  // method-level: adds role restriction
  @Roles('ADMIN', 'MANAGER')
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.productsService.findAll(user);
  }
}
```
`@CurrentUser()` yields `{ id, role, organizationId }` (`AuthUser` type). **Every service query must manually filter by `organizationId: user.organizationId`** — there is no global Prisma tenancy middleware, it's enforced by convention in every `where` clause. Do this in every new module without exception.

**DTO validation**: `class-validator` decorators (`@IsNotEmpty`, `@IsEnum`, `@IsNumber`, `@Min`, etc.), no Swagger decorators today. See [§2](#2-open-decisions-needed) — validation is currently not actually enforced (no global pipe), which this work should fix.

**Prisma model conventions**:
- `id String @id @default(uuid())` — not cuid/autoincrement.
- Every tenant-scoped model has both `organizationId String` scalar and `organization Organization @relation(...)`.
- Enums: PascalCase name, SCREAMING_SNAKE members.
- Prefer `isActive`/soft-delete boolean over hard `DELETE`, matching `User.isActive`.
- New models in this spec add `updatedAt DateTime @updatedAt` (not present on `User` today, but worth adding going forward).

**Response/error conventions**:
- Controllers return plain Prisma objects/DTOs directly — no `{ data, meta }` envelope exists yet (see [§2](#2-open-decisions-needed) for a proposed pagination envelope, since nothing paginates today).
- Always `select` explicit fields in Prisma queries to avoid leaking sensitive columns (mirrors `users.service.ts` excluding `password`).
- Existing modules throw `BadRequestException` for "not found" and `ForbiddenException` for permission denials; `NotFoundException` isn't used anywhere yet. See [§2](#2-open-decisions-needed) for a recommendation on this for new modules.

**Money fields**: the frontend currently does raw `number` (float) math for prices/totals/tax. Recommend all new money fields use Prisma `Decimal` (e.g. `@db.Decimal(12, 2)`), not `Float`, to avoid rounding drift on tax/discount math — this is the main "best implementation" correction this spec makes vs. how the frontend currently computes things.

---

## 2. Open decisions needed

These aren't purely backend calls — resolve them (with whoever owns product decisions) before or during implementation, because they change field shapes below.

1. **Currency/locale is inconsistent in the current frontend.** GSTIN/CGST/SGST/state-code fields (Accounting page) imply India, but Settings page defaults to `USD ($)` and dashboard/reports format as `$` with `en-IN` digit grouping in places. **Decide: is this an India-first GST product (recommended, given GSTIN/CGST/SGST already exist) or multi-currency?** The spec below assumes India/GST as primary and treats `currency`/`language` as an org-level setting for future multi-region support.
2. **Business identity is duplicated with conflicting mock values** between `app/(dashboard)/accounting/page.tsx` (GSTIN, state, state code, "NexBill Electronics Pvt. Ltd.", Bengaluru address) and `app/(dashboard)/settings/page.tsx` (phone, email, logo, "NexBill Electronics", Silicon Valley address). **Recommendation: one canonical `BusinessProfile` per organization** (modeled in [§3](#3-prisma-schema-additions)) — Accounting page becomes the tax/legal fields, Settings page becomes the contact/branding fields, both reading/writing the same entity. Frontend will need a small update to point both forms at one `GET/PUT /business/profile`.
3. **"Expenses" and "Net Profit" appear on Dashboard and Reports, but there is no page anywhere to record an expense.** Recommend adding a minimal `Expense` model + 2-3 endpoints now (in [§5](#5-phase-2--analytics)) even though there's no dedicated frontend page yet — otherwise "Net Profit"/"Expenses" stats and the "Revenue vs Expenses" chart have nothing real to show. Flag to the frontend owner that an Expenses entry UI is a follow-up.
4. **Invoice numbering**: Settings shows a "Starting Number" input (1001) as if it's just a display config, but a real sequence must be atomically incremented server-side per invoice. Recommendation: `InvoiceConfig.nextNumber` is the live counter; the Settings "Starting Number" field only writes it once when there are zero invoices yet (reject/ignore the write otherwise, to prevent number collisions/reuse).
5. **Settings page's single "Save Changes" button** currently implies saving 5 unrelated sections (business profile, invoice config, notifications, security, regional) at once. Recommend splitting into independent `PUT` calls per section (matches REST resources below) — frontend should fire them per-section (or in parallel on one click), not one mega-endpoint.
6. **2FA** ("Two-Factor Authentication" toggle in Settings) is a real feature (TOTP enrollment, secret/QR generation, backup codes), not a boolean flag. Recommend treating it as its own later phase rather than building it alongside everything else — call out to whoever is prioritizing.
7. **Theme selection** (light/dark/gradient) — recommend keeping this **client-only** (`localStorage`), not backend-persisted, unless cross-device sync is a real requirement.
8. **Adopt three deviations from the existing `users` module for all new modules**, since the current gaps would only get worse as more modules are added:
   - Add a global `ValidationPipe({ whitelist: true, transform: true })` in `main.ts` — right now `class-validator` decorators exist on DTOs but are never enforced.
   - Use `NotFoundException` (404) for "not found", not `BadRequestException`, for anything new.
   - Adopt one pagination envelope for any endpoint that lists rows: `{ data: T[], total: number, page: number, pageSize: number }`.
   These aren't required to make the new features work, but doing them now avoids baking the same gaps into 6 more modules.

---

## 3. Prisma schema additions

```prisma
enum PaymentMethod {
  CASH
  UPI
  CARD
}

enum BackupType {
  FULL
  INCREMENTAL
}

enum BackupStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

model Product {
  id             String   @id @default(uuid())
  name           String
  sku            String
  category       String
  price          Decimal  @db.Decimal(12, 2)
  cost           Decimal  @db.Decimal(12, 2)
  stock          Int      @default(0)
  minStock       Int      @default(0)
  gstRate        Decimal  @db.Decimal(5, 2) @default(18)
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String

  invoiceItems   InvoiceItem[]
  stockAdjustments StockAdjustment[]

  @@unique([sku, organizationId])
}

model StockAdjustment {
  id        String   @id @default(uuid())
  delta     Int                       // positive = restock, negative = damage/loss
  reason    String
  createdAt DateTime @default(now())

  product   Product @relation(fields: [productId], references: [id])
  productId String
  user      User    @relation(fields: [userId], references: [id])
  userId    String
}

model Customer {
  id             String   @id @default(uuid())
  name           String
  phone          String?
  email          String?
  address        String?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String

  invoices       Invoice[]
}

model Invoice {
  id              String        @id @default(uuid())
  invoiceNumber   String                       // formatted, e.g. "INV-1001"
  subtotal        Decimal       @db.Decimal(12, 2)
  discountPercent Decimal       @db.Decimal(5, 2) @default(0)
  discountAmount  Decimal       @db.Decimal(12, 2) @default(0)
  taxAmount       Decimal       @db.Decimal(12, 2)
  total           Decimal       @db.Decimal(12, 2)
  paymentMethod   PaymentMethod
  createdAt       DateTime      @default(now())

  organization    Organization @relation(fields: [organizationId], references: [id])
  organizationId  String
  customer        Customer?    @relation(fields: [customerId], references: [id])
  customerId      String?
  cashier         User         @relation(fields: [cashierId], references: [id])
  cashierId       String

  items           InvoiceItem[]

  @@unique([invoiceNumber, organizationId])
}

model InvoiceItem {
  id           String  @id @default(uuid())
  productName  String                     // snapshot at time of sale
  sku          String                     // snapshot at time of sale
  unitPrice    Decimal @db.Decimal(12, 2) // snapshot at time of sale
  quantity     Int
  taxRate      Decimal @db.Decimal(5, 2)
  taxAmount    Decimal @db.Decimal(12, 2)
  lineTotal    Decimal @db.Decimal(12, 2)

  invoice      Invoice @relation(fields: [invoiceId], references: [id])
  invoiceId    String
  product      Product @relation(fields: [productId], references: [id])
  productId    String
}

model Expense {
  id             String   @id @default(uuid())
  category       String
  amount         Decimal  @db.Decimal(12, 2)
  note           String?
  incurredAt     DateTime @default(now())
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String
}

model BusinessProfile {
  id             String   @id @default(uuid())
  name           String
  gstin          String?
  pan            String?
  state          String?
  stateCode      String?
  address        String?
  phone          String?
  email          String?
  logoUrl        String?
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String   @unique
}

model TaxConfig {
  id             String   @id @default(uuid())
  gstEnabled     Boolean  @default(true)
  cgstEnabled    Boolean  @default(false)
  sgstEnabled    Boolean  @default(false)
  igstEnabled    Boolean  @default(false)
  defaultGstRate Decimal  @db.Decimal(5, 2) @default(18)
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String   @unique
}

model InvoiceConfig {
  id             String   @id @default(uuid())
  prefix         String   @default("INV-")
  nextNumber     Int      @default(1001)
  footerNote     String?
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String   @unique
}

model RegionalSettings {
  id             String   @id @default(uuid())
  language       String   @default("en-IN")
  currency       String   @default("INR")
  dateFormat     String   @default("DD/MM/YYYY")
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String   @unique
}

model NotificationPreference {
  id                    String  @id @default(uuid())
  lowStockAlerts        Boolean @default(true)
  dailySalesSummary     Boolean @default(true)
  newTransactionAlerts  Boolean @default(false)
  systemUpdates         Boolean @default(true)

  user                  User    @relation(fields: [userId], references: [id])
  userId                String  @unique
}

model Backup {
  id             String       @id @default(uuid())
  type           BackupType
  status         BackupStatus @default(PENDING)
  sizeBytes      BigInt?
  downloadUrl    String?
  createdAt      DateTime     @default(now())
  completedAt    DateTime?

  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String
}

model BackupSchedule {
  id             String   @id @default(uuid())
  frequency      String                     // "daily" | "weekly" | "monthly"
  time           String                     // "HH:mm"
  retentionCount Int      @default(7)
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String   @unique
}
```

Also add `sessionTimeoutMinutes Int @default(30)` and `twoFactorEnabled Boolean @default(false)` directly to the existing `User` model (they're per-user, not worth a new table), and add the inverse relation arrays (`products`, `invoices`, etc.) to `Organization`.

---

## 4. Phase 1 — Core transactional

Unlocks `app/(dashboard)/billing/page.tsx` and `app/(dashboard)/inventory/page.tsx`. Build this first — Phase 2's analytics endpoints read from the data this phase creates.

### Products (`src/products/`)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/products` | ADMIN, MANAGER, CASHIER | Query: `search`, `category`, `status` (`in-stock`\|`low-stock`\|`out-of-stock`, computed from `stock` vs `minStock`, not stored), `sortBy`, `sortDir`, `page`, `pageSize`. **CASHIER role: omit `cost` from the response** (margin data shouldn't reach POS operators). |
| GET | `/products/:id` | ADMIN, MANAGER, CASHIER | |
| GET | `/products/lookup?barcode=` | ADMIN, MANAGER, CASHIER | Powers the currently-unwired barcode/SKU scan input on the Billing page. |
| GET | `/products/categories` | ADMIN, MANAGER | Returns `{ name, count }[]` computed live via `GROUP BY category` — replaces today's hardcoded chip counts. |
| POST | `/products` | ADMIN, MANAGER | Body: `{ name, sku, category, price, cost, stock, minStock, gstRate? }`. `sku` unique per org. |
| PATCH | `/products/:id` | ADMIN, MANAGER | Same fields, partial. |
| DELETE | `/products/:id` | ADMIN, MANAGER | Soft delete (`isActive = false`) since `InvoiceItem` snapshots reference products historically — never hard-delete a product with invoice history. |
| POST | `/products/:id/stock-adjustment` | ADMIN, MANAGER | Body: `{ delta: number, reason: string }`. Updates `stock` and writes a `StockAdjustment` row (audit trail) in one transaction. |
| GET | `/products/export?format=csv` | ADMIN, MANAGER | |

Computed `status` (`in-stock`/`low-stock`/`out-of-stock`) should be derived the same way in every response: `stock === 0 → out-of-stock`, `stock <= minStock → low-stock`, else `in-stock`. Don't store it — the current frontend mock has it as a separate field that can drift from `stock`/`minStock`; don't repeat that bug.

### Customers (`src/customers/`) — new module, not just a frontend gap

The Billing page currently captures customer as a bare text input with nothing persisted. For invoices to mean anything, add a minimal customer directory:

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/customers?search=` | ADMIN, MANAGER, CASHIER | Search by name/phone/email for the POS "customer" field to become a real lookup. |
| POST | `/customers` | ADMIN, MANAGER, CASHIER | Body: `{ name, phone?, email?, address? }` — quick-create from POS when no match found. |

**Frontend follow-up needed**: replace the plain `Input` for customer name (`app/page.tsx`... actually `billing/page.tsx:163-171`) with a search-or-create combobox once this exists.

### Invoices / Billing (`src/invoices/`)

This is the endpoint behind the currently-dead "Generate Invoice" button.

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/invoices` | ADMIN, MANAGER, CASHIER | See body/behavior below. |
| GET | `/invoices?from=&to=&page=&pageSize=` | ADMIN, MANAGER | Powers Dashboard "Recent Transactions" and Reports. |
| GET | `/invoices/:id` | ADMIN, MANAGER | |
| GET | `/invoices/:id/pdf` | ADMIN, MANAGER, CASHIER | Printable invoice (for the till printer / customer copy). |

**`POST /invoices` request body**:
```json
{
  "customerId": "uuid | null",
  "items": [{ "productId": "uuid", "quantity": 2 }],
  "discountPercent": 0,
  "paymentMethod": "CASH"
}
```

**Server-side behavior (all inside one Prisma `$transaction`)** — this is the important correction vs. how the frontend currently works (`billing/page.tsx:80-83` computes everything client-side with a hardcoded `0.18` GST rate):
1. Re-fetch each `Product` by id, scoped to `organizationId` — **never trust a client-sent price**.
2. Reject if `quantity > stock` for any line (insufficient stock).
3. Compute per-line: `lineSubtotal = unitPrice * quantity`, `taxAmount = lineSubtotal * (product.gstRate / 100)`, `lineTotal = lineSubtotal + taxAmount`.
4. `subtotal = Σ lineSubtotal`; `discountAmount = subtotal * (discountPercent / 100)`; `taxAmount = Σ per-line tax` (recompute post-discount proportionally, or keep pre-discount tax and note it — pick one and be consistent, current frontend does post-discount-flat-18%, which doesn't support per-product GST rates once those exist).
5. `total = subtotal - discountAmount + taxAmount`.
6. Atomically increment `InvoiceConfig.nextNumber`, format as `${prefix}${nextNumber}`.
7. Decrement each `Product.stock` by `quantity`.
8. Insert `Invoice` + `InvoiceItem[]` (snapshotting `productName`/`sku`/`unitPrice`/`taxRate` at time of sale, so later price/name edits on `Product` don't rewrite history).
9. Return the full invoice (id, invoiceNumber, items, totals) for the frontend to print/display.

Note: `UPI`/`CARD` are just labels for now (no payment gateway integration implied) — persist `paymentMethod` as selected, don't attempt gateway integration unless separately scoped.

---

## 5. Phase 2 — Analytics

Read-only aggregation over Phase 1 data (`Invoice`, `InvoiceItem`, `Product`, plus the new `Expense` model — see [§2 item 3](#2-open-decisions-needed)). All ADMIN + MANAGER (matches `route-access.ts` for `/dashboard` and `/reports`; no CASHIER).

### Expenses (`src/expenses/`) — minimal, needed for the stats below

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/expenses?from=&to=` | ADMIN, MANAGER | |
| POST | `/expenses` | ADMIN, MANAGER | Body: `{ category, amount, note?, incurredAt? }`. No dedicated frontend page exists yet for this — flag to frontend owner. |

### Dashboard (`src/dashboard/`)

| Method | Path | Replaces | Response shape |
|---|---|---|---|
| GET | `/dashboard/stats` | `stats` array, `dashboard/page.tsx:21-58` | `{ todaysSales: number, todaysSalesChangePercent: number, netProfit: number, netProfitChangePercent: number, expenses: number, expensesChangePercent: number, lowStockCount: number, lowStockDelta: number }` — raw numbers; frontend formats currency/%/icons/colors, which are presentational only. |
| GET | `/dashboard/sales-trend?range=daily\|weekly\|monthly` | `salesData`, `dashboard-charts.tsx:19-27` | `{ period: string, sales: number }[]` — the range toggle currently does nothing client-side; wire it to refetch this. |
| GET | `/dashboard/sales-by-category?range=` | `categoryData`, `dashboard-charts.tsx:29-35` | `{ category: string, sharePercent: number }[]` |
| GET | `/dashboard/recent-transactions?limit=5` | `transactions`, `recent-transactions.tsx:10-51` | `{ id, invoiceNumber, customerName, amount, paymentMethod, status, createdAt }[]` — return ISO `createdAt`, let frontend format "2 min ago". |
| GET | `/dashboard/top-products?range=&limit=5` | `products`, `top-products.tsx:9-45` | `{ productId, name, unitsSold, revenue }[]` — frontend computes the `progress` bar-width % client-side from `revenue`, don't send it. |

### Reports (`src/reports/`)

| Method | Path | Replaces | Notes |
|---|---|---|---|
| GET | `/reports/summary-stats?range=` | `stats`, `reports/page.tsx:59-64` | Total Revenue, Total Orders, Avg Order Value, New Customers, each with `changePercent`. |
| GET | `/reports/revenue-expenses?range=` | `salesData`, `reports/page.tsx:32-40` | `{ period, revenue, expenses }[]` |
| GET | `/reports/sales-by-category?from=&to=` | `categoryData`, `reports/page.tsx:42-48` | `{ category, sales }[]` |
| GET | `/reports/gst-summary?from=&to=` | `taxReport`, `reports/page.tsx:50-57` | `{ grossSales, returns, netSales, gstCollected, inputTaxCredit, netGstPayable }` — **compute these server-side from real invoices**, don't ship raw rows and let the frontend sum them (today's mock does the sum client-side from static numbers; that logic must not survive into the real version). |
| GET | `/reports/export?format=xlsx\|csv&from=&to=` | "Export" button, no handler | |
| POST | `/reports/gst/generate` | "Generate GST Report" button, no handler | Returns a PDF. Likely the same underlying generator as Utilities' "Export Tax Reports" — reconcile into one implementation, don't build twice. |

Also wire the Date Range picker (currently unwired, `reports/page.tsx:95-97`) to `from`/`to` query params on all of the above.

---

## 6. Phase 3 — Configuration

Powers `app/(dashboard)/accounting/page.tsx` (ADMIN only, per `route-access.ts:9`) and the business-facing parts of `app/(dashboard)/settings/page.tsx` (ADMIN + MANAGER, per `route-access.ts:11`). Per [§2 item 2](#2-open-decisions-needed), Accounting and Settings both read/write the **same** `BusinessProfile`/`InvoiceConfig`/`TaxConfig`/`RegionalSettings` entities — split by which fields each page shows, not by separate tables.

| Method | Path | Roles | Body / notes |
|---|---|---|---|
| GET / PUT | `/business/profile` | ADMIN (write), ADMIN+MANAGER (read) | `{ name, gstin, pan, state, stateCode, address, phone, email, logoUrl }` — full canonical set; Accounting page shows the tax/legal subset, Settings shows the contact/branding subset, same resource. |
| POST | `/business/logo` | ADMIN | Multipart upload (PNG/JPG, ≤2MB per the existing UI hint), returns `{ logoUrl }`, also sets it on `BusinessProfile`. |
| GET / PUT | `/settings/tax-config` | ADMIN | `{ gstEnabled, cgstEnabled, sgstEnabled, igstEnabled, defaultGstRate }` — replaces the static, unwired `taxTypes` switches and the "Apply" custom-rate button in `accounting/page.tsx:130,136-140`. `defaultGstRate` becomes the default `Product.gstRate` for newly created products (product-level rate still overridable per product). |
| GET / PUT | `/settings/invoice-config` | ADMIN, MANAGER | `{ prefix, footerNote }` — **`nextNumber` is read-only in this endpoint** (managed only by the invoice-create transaction in Phase 1); only accept a one-time write to seed it when `Invoice` count for the org is 0 (see [§2 item 4](#2-open-decisions-needed)). |
| GET / PUT | `/settings/regional` | ADMIN, MANAGER | `{ language, currency, dateFormat }` |

The Accounting page's live invoice preview (`invoicePreview`, `accounting/page.tsx:30-40`) should stop being static mock data — compute it from `TaxConfig` + a sample/real line item using the exact same tax-calc logic as `POST /invoices` in Phase 1 (extract that into one shared service/function used by both, so preview and real invoices can never disagree).

---

## 7. Phase 4 — Personal/account

Self-service, any authenticated user acting on their own account (not role-gated the way business config is) — powers the rest of `app/(dashboard)/settings/page.tsx`.

| Method | Path | Notes |
|---|---|---|
| GET / PUT | `/users/me/notification-preferences` | `{ lowStockAlerts, dailySalesSummary, newTransactionAlerts, systemUpdates }` |
| PUT | `/users/me/security-settings` | `{ sessionTimeoutMinutes }` |
| POST | `/users/me/change-password` | `{ currentPassword, newPassword }` — verify current with `bcrypt.compare` (already a dependency) before updating. |
| POST | `/users/me/2fa/enable` / `/disable` | See [§2 item 6](#2-open-decisions-needed) — recommend deferring to its own phase; this needs TOTP secret generation + QR + backup codes, not a boolean flag. |

Theme preference: intentionally **not** listed here — see [§2 item 7](#2-open-decisions-needed) (recommend client-only).

---

## 8. Phase 5 — Ops/Utilities (lower priority)

Powers `app/(dashboard)/utilities/page.tsx` (ADMIN only). Lowest priority — none of the other pages depend on this data existing.

| Method | Path | Notes |
|---|---|---|
| GET | `/system/health` | `{ cpuPercent, memoryPercent, storagePercent, networkPercent }` — real infra metrics. Frontend already derives the `status`/color purely from thresholds on `value`; don't send a `status` field. |
| GET | `/backups?page=&pageSize=` | List backup history. |
| POST | `/backups` | Body: `{ type: "FULL" \| "INCREMENTAL" }`. Kicks off a real backup job (async worker), returns the created `Backup` row with `status: PENDING`. **Replace the frontend's fake `setInterval` progress bar** (`utilities/page.tsx:41-56`) with polling `GET /backups/:id` (or SSE) for real status/progress. |
| GET | `/backups/:id` | Poll for status. |
| GET | `/backups/:id/download` | |
| POST | `/backups/:id/restore` | |
| GET / PUT | `/backups/schedule` | `{ frequency, time, retentionCount }` |
| GET | `/exports/sales?format=xlsx` | |
| GET | `/exports/inventory?format=csv` | |
| GET | `/exports/tax-reports?format=pdf` | Same generator as `/reports/gst/generate` — implement once, expose from both places. |
| POST | `/system/optimize-db` | |
| POST | `/system/clear-cache` | |

---

## 9. Explicitly out of scope / cosmetic-only

Don't build backend endpoints for these — they're either purely presentational or a client-side-only concern:
- The backup progress bar's 0→100 tick animation mechanism itself (real progress comes from polling `GET /backups/:id`, per §8, but the *animation* is frontend).
- Theme selection (light/dark/gradient) — recommend `localStorage` only, per [§2 item 7](#2-open-decisions-needed).
- Any `color`/`icon`/Tailwind-class fields seen in the mock data throughout (`categoryData[].color`, `stats[].icon`, etc.) — these are presentational and never need to come from the API.
- The Accounting page's step-wizard visuals (icons/progress bar chrome) — only the underlying "which step" datum is worth persisting if resuming onboarding matters (optional, not in this spec).
