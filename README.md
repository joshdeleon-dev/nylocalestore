# NY Locale Store - Full-Stack Coffee Shop Platform

A modern, production-ready full-stack coffee shop ordering and management platform built with Next.js 15, TypeScript, Tailwind CSS, and Supabase.

## Features

### Customer Ordering Application
- 🍕 Intuitive menu browsing with categories and search
- 🎨 Beautiful product customization with modifiers (Size, Milk, Add-ons)
- 🛒 Smart shopping cart with real-time calculations
- 💳 Secure checkout with order confirmation
- 📱 Mobile-first, responsive design (PWA-ready)

### Multiple Dashboards
- **Barista Dashboard**: Tablet-friendly live queue with order management
- **Cashier Dashboard**: Payment and order completion tracking
- **Manager Dashboard**: Orders, inventory, products, and reports
- **Admin Dashboard**: Full system access, user management, audit logs

### Advanced Features
- ✅ Role-Based Access Control (RBAC)
- 📊 Comprehensive Sales & Inventory Reporting
- 🏭 Inventory Management with Low Stock Alerts
- 📋 Custom Report Builder with Export (CSV, Excel)
- 🖨️ Thermal Printer-Friendly Sticker Printing
- 🔍 Full Audit Logging
- 🌍 Multi-location Ready Architecture
- 🌙 Dark Mode Support

### Order Management
- Order workflow: NEW → ACCEPTED → IN_PROGRESS → READY → COMPLETED
- Unique order numbering: ORD-YYYYMMDD-XXXX
- Real-time order tracking
- Group-based ordering
- Payment status tracking

### Inventory System
- Real-time stock tracking
- Low stock alerts and thresholds
- Auto-deduction after order completion
- Inventory history and audit logs
- Stock adjustment with reasons

### Reporting Center
- Daily, Weekly, Monthly, Quarterly, Yearly reports
- Custom date range selection
- Sales metrics: Revenue, Orders, Average Ticket, etc.
- Product performance analytics
- Inventory status reports
- Export to CSV and Excel

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components + Lucide React icons
- **State Management**: Zustand
- **Notifications**: React Hot Toast

### Backend
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **API**: Next.js API Routes
- **Storage**: Supabase Storage (for product images)

### Deployment
- **Hosting**: Vercel
- **Domain**: nylocalestore.com (marketing), order.nylocalestore.com (app)

## Project Structure

```
ny-locale-store/
├── src/
│   ├── app/                          # Next.js app directory
│   │   ├── api/                     # API routes
│   │   │   ├── orders/             # Order endpoints
│   │   │   ├── products/           # Product endpoints
│   │   │   ├── inventory/          # Inventory endpoints
│   │   │   └── reports/            # Reporting endpoints
│   │   ├── dashboard/              # Protected dashboards
│   │   │   ├── barista/            # Barista dashboard
│   │   │   ├── cashier/            # Cashier dashboard
│   │   │   ├── manager/            # Manager dashboard
│   │   │   └── admin/              # Admin dashboard
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Home/Menu page
│   │   └── providers.tsx           # App providers
│   ├── components/                  # Reusable components
│   │   ├── common/                 # Common UI components
│   │   ├── forms/                  # Form components
│   │   ├── dashboard/              # Dashboard components
│   │   └── layout/                 # Layout components
│   ├── hooks/                       # Custom React hooks
│   │   └── useCart.ts              # Cart state management
│   ├── lib/                        # Utilities and helpers
│   │   └── supabase.ts             # Supabase client
│   ├── types/                      # TypeScript types
│   │   └── index.ts                # All type definitions
│   ├── utils/                      # Utility functions
│   │   ├── helpers.ts              # General helpers
│   │   └── rbac.ts                 # Permission utilities
│   └── styles/                     # Global styles
│       └── globals.css             # Tailwind & components
├── supabase/
│   └── migrations/
│       ├── 001_init_schema.sql     # Database schema
│       └── 002_seed_data.sql       # Initial data
├── public/                          # Static assets
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
└── .env.example

```

## Database Schema

### Core Tables
- **roles**: User roles (ADMIN, MANAGER, BARISTA, CASHIER, CUSTOMER)
- **permissions**: System permissions
- **role_permissions**: Role-permission mapping
- **users**: User accounts with role and location
- **locations**: Store locations (multi-location ready)

### Products & Catalog
- **categories**: Product categories
- **products**: Beverage and food products
- **modifier_groups**: Customization groups (Size, Milk, Add-ons)
- **modifiers**: Individual modifiers with pricing
- **product_modifier_groups**: Mapping products to modifier groups

### Orders & Sales
- **orders**: Order records with totals, status, payment info
- **order_items**: Individual items in each order
- **order_item_modifiers**: Modifiers applied to items

### Inventory
- **inventory**: Current stock levels per location
- **inventory_logs**: Audit trail of all inventory changes

### System
- **audit_logs**: Full audit trail of all changes
- **settings**: Store-specific settings and configurations

## Setup & Installation

### Prerequisites
- Node.js 18+ and npm/yarn
- Supabase account (free tier available)
- Vercel account (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "NY Locale Store v2"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project at https://supabase.com
   - Copy your project URL and API keys
   - Create `.env.local` file in the project root
   ```bash
   cp .env.example .env.local
   ```

4. **Configure environment variables**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

5. **Run database migrations**
   ```bash
   # Using Supabase CLI
   supabase link --project-ref <project-ref>
   supabase db push
   ```

   Or manually run the SQL migration files in your Supabase SQL editor:
   - `supabase/migrations/001_init_schema.sql`
   - `supabase/migrations/002_seed_data.sql`

6. **Start development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser

## API Documentation

### Orders

#### Create Order
```bash
POST /api/orders
Content-Type: application/json

{
  "customer_name": "John Doe",
  "customer_phone": "(555) 123-4567",
  "group_number": 12,
  "items": [
    {
      "product_id": 1,
      "quantity": 2,
      "modifiers": [
        { "id": 1, "name": "Large", "price_adjustment": 1.00 },
        { "id": 5, "name": "Oat Milk", "price_adjustment": 0.75 }
      ]
    }
  ],
  "notes": "Extra hot",
  "payment_method": "CASH",
  "tax_rate": 0.0875
}
```

#### Get Orders
```bash
GET /api/orders?status=NEW&limit=50&offset=0
```

#### Update Order Status
```bash
PUT /api/orders/:id
Content-Type: application/json

{
  "status": "IN_PROGRESS",
  "payment_status": "PAID"
}
```

### Products

#### Get Products
```bash
GET /api/products?category_id=1&limit=100
```

#### Create Product (Admin)
```bash
POST /api/products
Content-Type: application/json

{
  "name": "Cappuccino",
  "description": "Espresso with steamed milk",
  "category_id": 1,
  "base_price": 4.45,
  "image_url": "https://...",
  "display_order": 1
}
```

### Inventory

#### Get Inventory
```bash
GET /api/inventory?location_id=1
```

#### Adjust Stock
```bash
POST /api/inventory/adjust
Content-Type: application/json

{
  "product_id": 1,
  "location_id": 1,
  "quantity_change": -5,
  "adjustment_reason": "Order completed",
  "reference_type": "ORDER",
  "reference_id": "ORD-20260622-0001"
}
```

### Reports

#### Get Sales Report
```bash
GET /api/reports/sales?start_date=2026-01-01&end_date=2026-01-31&period=daily
```

#### Export Report
```bash
GET /api/reports/export?format=xlsx&type=sales
```

## User Roles & Permissions

### ADMIN
- Full system access
- User management
- System configuration
- All reports and audit logs

### MANAGER
- Order management
- Inventory management
- Product management
- Sales reports
- Audit logs (view-only)

### BARISTA
- View orders in queue
- Update order status
- Print stickers
- View assigned orders only

### CASHIER
- View orders
- Update payment status
- Mark orders as completed
- Partial order access

### CUSTOMER
- Browse menu
- Place orders
- View order history
- Track order status

## Deployment to Vercel

### Prerequisites
- Vercel account
- GitHub repository (recommended)

### Steps

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect to Vercel**
   - Visit [vercel.com](https://vercel.com)
   - Click "New Project"
   - Select your GitHub repository
   - Configure build settings:
     - Framework: Next.js
     - Node.js Version: 18.x

3. **Set Environment Variables**
   In Vercel Project Settings → Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   NEXT_PUBLIC_API_URL=https://order.nylocalestore.com
   ```

4. **Configure Domains**
   - Main domain: nylocalestore.com (marketing/public)
   - App subdomain: order.nylocalestore.com (ordering app)

5. **Deploy**
   ```bash
   npm run build
   ```

## Role-Based Access Control (RBAC)

The application implements a comprehensive RBAC system:

### Permission Strings
Permissions follow the format: `resource:action`
- `orders:view`, `orders:create`, `orders:update`, `orders:cancel`
- `products:view`, `products:create`, `products:update`, `products:delete`
- `inventory:view`, `inventory:adjust`, `inventory:view_reports`
- `reports:view`, `reports:create_custom`, `reports:export`
- `users:manage`
- `sticker:print`
- `audit:view`

### Protected Routes
All dashboard routes are protected by role:
- `/dashboard/barista` - Barista only
- `/dashboard/cashier` - Cashier only
- `/dashboard/manager` - Manager and Admin
- `/dashboard/admin` - Admin only

### Middleware Protection
API routes check permissions before processing requests. Client-side components hide unauthorized options.

## Performance Optimizations

- Server-side rendering for fast initial page load
- Incremental static regeneration (ISR)
- Image optimization with Next.js Image
- Code splitting and lazy loading
- Database query optimization with indexes
- Caching strategies

## Security Features

- Row-Level Security (RLS) in Supabase
- JWT authentication
- CSRF protection
- Input validation and sanitization
- SQL injection prevention (via Supabase)
- Secure password hashing
- Audit logging of all changes
- Rate limiting (recommended to add)

## Testing

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build
npm run build
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Proprietary - NY Locale Store

## Support

For support, contact the development team or visit the documentation.

## Roadmap

### Phase 1 (Complete)
- ✅ Core ordering system
- ✅ Multiple dashboards
- ✅ Inventory management
- ✅ Basic reporting

### Phase 2 (Planned)
- Multi-location support
- Advanced analytics
- Loyalty program integration
- Real-time notifications
- Mobile app

### Phase 3 (Future)
- AI-powered recommendations
- Thermal printer integration (Dymo, Munbyn, Brother QL, Phomemo)
- Scheduled reports
- Customer feedback system
- Integration with POS systems

## Credits

Built with ❤️ using Next.js, TypeScript, Tailwind CSS, and Supabase.
