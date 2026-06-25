# Architecture Overview - NY Locale Store

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     CUSTOMER DEVICES                        │
│              (Desktop, Tablet, Mobile)                      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/HTTPS
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    VERCEL (Hosting)                         │
│                   Next.js 15 App                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Frontend (React + TypeScript)               │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  - Customer Ordering App (/)                        │   │
│  │  - Shopping Cart (/cart)                            │   │
│  │  - Checkout (/checkout)                             │   │
│  │  - Order Confirmation (/confirmation)               │   │
│  │  - Barista Dashboard (/dashboard/barista)           │   │
│  │  - Cashier Dashboard (/dashboard/cashier)           │   │
│  │  - Manager Dashboard (/dashboard/manager)           │   │
│  │  - Admin Dashboard (/dashboard/admin)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         API Routes (Next.js)                        │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  /api/orders              (CRUD)                    │   │
│  │  /api/products            (CRUD)                    │   │
│  │  /api/inventory           (Read, Adjust)            │   │
│  │  /api/reports             (Read, Export)            │   │
│  │  /api/categories          (CRUD)                    │   │
│  │  /api/users               (CRUD - Admin)            │   │
│  │  /api/audit-logs          (Read - Admin)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │    Client Libraries & State Management              │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  - Supabase Client (@supabase/supabase-js)          │   │
│  │  - Zustand (Cart State Store)                       │   │
│  │  - React Hot Toast (Notifications)                  │   │
│  │  - Custom Hooks (useCart, etc.)                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS/REST API
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                  SUPABASE (Backend)                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │      PostgreSQL Database                            │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ Roles &  │  │ Products │  │ Orders   │          │   │
│  │  │ Permissions │ & Categories  & Items   │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │Modifiers │  │Locations │  │Inventory │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  │  ┌──────────┐  ┌──────────┐                        │   │
│  │  │Audit Logs│  │Settings  │                        │   │
│  │  └──────────┘  └──────────┘                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │      Authentication & Authorization                │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  - Supabase Auth (JWT)                              │   │
│  │  - Row-Level Security (RLS)                         │   │
│  │  - Role-Based Access Control (RBAC)                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │      Storage (for product images)                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Layer

#### Pages (Next.js App Router)
- **Public Pages**: Home, Cart, Checkout, Confirmation, Order Status
- **Protected Pages**: All Dashboard pages (Barista, Cashier, Manager, Admin)
- **API Routes**: RESTful endpoints for CRUD operations

#### Components
- **Common**: Header, Footer, Navigation, Buttons, Forms, Cards
- **Forms**: Checkout forms, Product customization
- **Dashboard**: Order cards, Status indicators, Action buttons
- **Layout**: Responsive grid layouts, Sidebars

#### State Management (Zustand)
- **useCartStore**: Shopping cart state, calculations, persistence
- **useAuthStore** (future): User authentication state
- **useOrderStore** (future): Order tracking state

### Backend Layer (Supabase)

#### Database Schema
Organized into logical domains:

1. **Identity** (roles, permissions, users)
2. **Catalog** (categories, products, modifiers)
3. **Orders** (orders, order_items, order_item_modifiers)
4. **Inventory** (inventory, inventory_logs)
5. **System** (audit_logs, settings)

#### Authentication
- Supabase Auth with JWT tokens
- Session management
- Row-Level Security policies

#### Business Logic
- Trigger functions for inventory deduction
- Validation constraints
- Cascading deletes

## Data Flow

### Order Creation Flow

```
User Creates Order
    ↓
Frontend Cart State (Zustand)
    ↓
User Submits Checkout Form
    ↓
POST /api/orders (Next.js API Route)
    ↓
Validate Order Data
    ↓
Calculate Totals & Tax
    ↓
Create Order Record (Supabase)
    ↓
Create Order Items (per item in cart)
    ↓
Create Item Modifiers (per modifier)
    ↓
Clear Cart & Redirect to Confirmation
    ↓
Real-time Updates Sent to Barista Dashboard
```

### Order Status Update Flow

```
Barista Updates Order Status
    ↓
PUT /api/orders/:id (Next.js API Route)
    ↓
Update Order Record (Supabase)
    ↓
Trigger Audit Log (if enabled)
    ↓
Trigger Inventory Deduction (if order completed)
    ↓
Real-time Updates via Supabase Subscription
    ↓
Cashier/Barista Dashboard Updates Live
```

### Report Generation Flow

```
Manager Requests Report
    ↓
SELECT from API Route with Filters
    ↓
Query Database for Orders + Items + Modifiers
    ↓
Perform Calculations (totals, averages, grouping)
    ↓
Format Report Data
    ↓
Generate CSV/Excel Export
    ↓
Send File to Client
```

## Security Architecture

### Authentication
- JWT tokens issued by Supabase Auth
- Tokens stored securely (httpOnly cookies or localStorage)
- Token refresh mechanism

### Authorization (RBAC)
- Role-based permission matrix
- Endpoint-level protection
- Component-level hiding of unauthorized features
- Database-level RLS policies

### Data Protection
- All API communication over HTTPS
- Sensitive keys never exposed in frontend code
- Environment variables for secrets
- Service role key only used server-side

### Audit Trail
- All data changes logged in audit_logs table
- User, action, old/new values tracked
- Timestamps recorded
- Enables compliance and debugging

## Scalability Considerations

### Horizontal Scaling
- Vercel auto-scales based on traffic
- Supabase handles database scaling
- Stateless API design enables multiple instances

### Performance Optimization
- Database indexes on frequently queried columns
- API response caching (future enhancement)
- Image optimization with Next.js Image component
- Code splitting and lazy loading

### Monitoring & Analytics
- Vercel Web Analytics
- Database performance monitoring
- Error tracking and logging
- Real-time queue status

## Technology Stack Details

### Frontend
- **Next.js 15**: React framework with SSR/SSG
- **TypeScript**: Type safety across codebase
- **Tailwind CSS**: Utility-first CSS framework
- **Zustand**: Lightweight state management
- **React Hot Toast**: Notifications
- **Lucide React**: Icon library

### Backend
- **Supabase**: PostgreSQL + Auth + Storage
- **PostgreSQL**: Relational database
- **PostgREST**: Auto-generated REST API
- **Realtime**: WebSocket for live updates
- **JWT**: Secure authentication

### Infrastructure
- **Vercel**: Next.js hosting and CDN
- **GitHub**: Version control and CI/CD
- **Edge Functions**: Serverless execution

## Multi-Location Architecture

```
NY Locale Store (Multi-Location Ready)
├── Location 1 (Downtown)
│   ├── Inventory (location-specific)
│   ├── Staff (assigned users)
│   └── Settings (location-specific)
├── Location 2 (Uptown)
│   ├── Inventory (location-specific)
│   ├── Staff (assigned users)
│   └── Settings (location-specific)
└── Location 3 (Brooklyn)
    ├── Inventory (location-specific)
    ├── Staff (assigned users)
    └── Settings (location-specific)

Shared Resources
├── Global Products
├── Global Categories
├── Global Modifiers
└── Global Reports (with location filtering)
```

## Future Enhancement Architecture

### Phase 2 Additions
```
Current System
    ↓
Add Mobile App Layer (React Native)
    ↓
Add WebSocket Server (Real-time updates)
    ↓
Add Analytics Engine (Data warehouse)
    ↓
Add Loyalty Program (New tables + logic)
```

### Phase 3 Additions
```
Current System
    ↓
Add Thermal Printer Integration (via Dymo/Brother API)
    ↓
Add Machine Learning (Demand forecasting)
    ↓
Add Payment Gateway (Stripe/Square integration)
    ↓
Add Email/SMS Notifications (SendGrid/Twilio)
```

## Deployment Architecture

```
Development
    ↓ (git push)
GitHub
    ↓ (auto-trigger)
Vercel CI/CD
    ↓ (npm run build)
Build & Test
    ↓ (success)
Deploy to Preview
    ↓ (manual approval)
Deploy to Production
    ↓
Vercel Edge Network CDN
    ↓
Global Distribution
    ↓
Customer Devices
```

## Database Indexing Strategy

### High-Priority Indexes (Already in schema)
- `orders(order_number)` - Fast order lookup
- `orders(status)` - Filter by status
- `orders(order_date)` - Date-range queries
- `products(category_id)` - Category browsing
- `users(email)` - User authentication

### Future Indexes (Add as needed)
- `orders(customer_name)` - Customer search
- `orders(group_number)` - Group-based queries
- `order_items(product_id)` - Product analytics
- `inventory_logs(created_at)` - History queries

## API Design Principles

1. **RESTful**: Standard HTTP methods (GET, POST, PUT, DELETE)
2. **Stateless**: No server-side session state
3. **Versioned**: URL includes version if needed (`/api/v1/orders`)
4. **Paginated**: Large result sets support pagination
5. **Filtered**: Query parameters for filtering
6. **Documented**: Clear request/response examples

## Error Handling Strategy

### Frontend
- User-friendly error messages
- Toast notifications for errors
- Graceful fallbacks
- Error boundaries for React errors

### Backend
- Detailed error logging
- Appropriate HTTP status codes
- Structured error responses
- Validation before processing

### Database
- Constraint violations handled
- Transaction rollback on error
- Audit logging of errors
- Connection pooling

---

This architecture provides a solid foundation for scaling to thousands of concurrent users while maintaining code clarity and ease of maintenance.
