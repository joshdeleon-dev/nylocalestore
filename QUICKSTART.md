# Quick Start Guide - NY Locale Store

Get the NY Locale Store platform up and running in 10 minutes!

## Prerequisites (already have? Skip to Step 1)
- Node.js 18+: https://nodejs.org/
- Git: https://git-scm.com/
- Supabase account: https://supabase.com (free)
- Vercel account: https://vercel.com (free, for later)

## Step 1: Set Up Supabase (2 minutes)

1. Go to https://supabase.com and create a new project
2. Wait for initialization
3. Go to **Settings → API** and copy:
   - `Project URL` 
   - `anon public` key
   - `service_role` key

## Step 2: Set Up Local Project (3 minutes)

```bash
# Navigate to project directory
cd "/Users/joshdeleon/Desktop/WebDev/NY Locale Store v2"

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local with your Supabase keys
# NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Step 3: Set Up Database (2 minutes)

### Option A: Using Supabase Dashboard (Recommended for beginners)
1. Log in to your Supabase project
2. Click **SQL Editor** → **New Query**
3. Copy the contents of `supabase/migrations/001_init_schema.sql`
4. Paste into SQL editor and run
5. Repeat for `supabase/migrations/002_seed_data.sql`

### Option B: Using Supabase CLI (For developers)
```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

## Step 4: Run Locally (2 minutes)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

## What You Can Do Now

### 👤 Customer Ordering
- Browse menu by category
- Add items to cart with customizations
- Proceed to checkout
- Place order and see confirmation

### 💼 Barista Dashboard
Visit [http://localhost:3000/dashboard/barista](http://localhost:3000/dashboard/barista)
- View live order queue
- Update order status
- Print order stickers

## Test Data

The seed data includes:
- 3 sample locations
- 8 product categories
- 30+ products (coffee, tea, pastries)
- 4 modifier groups (Size, Milk, Add-ons)
- Sample inventory

## Default Admin User Setup (Optional)

If you need to test as admin, you'll need to create authentication. For now:
- All dashboards are accessible (role-based access control checks structure ready)
- Authorization will be enforced once Supabase Auth is configured

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
```bash
npm install
```

### "Supabase connection failed"
- Check environment variables are set correctly
- Verify Supabase project is running
- Ensure database migrations ran successfully

### Port 3000 already in use
```bash
npm run dev -- -p 3001
```

## Next Steps

### 1. Deploy to Vercel (5 minutes)
```bash
git init
git add .
git commit -m "Initial commit"
git push origin main
```
Then follow DEPLOYMENT.md

### 2. Customize for Your Business
- Update product catalog
- Adjust tax rate in locations
- Customize branding colors
- Add product images

### 3. Configure Authentication
- Set up Supabase Auth
- Create user roles/staff
- Configure RLS policies

## Documentation

- **Full README**: See README.md
- **Architecture**: See ARCHITECTURE.md
- **Deployment**: See DEPLOYMENT.md
- **API Docs**: See README.md → API Documentation

## Key Files to Know

```
src/
├── app/                    # Pages and routes
│   ├── page.tsx           # Home/menu page
│   ├── cart/page.tsx      # Shopping cart
│   ├── checkout/page.tsx  # Checkout
│   ├── dashboard/         # Protected dashboards
│   └── api/               # API routes
├── lib/supabase.ts        # Supabase client
├── types/index.ts         # All TypeScript types
├── utils/
│   ├── helpers.ts         # Utility functions
│   └── rbac.ts            # Permission helpers
├── constants/index.ts     # App constants
└── hooks/useCart.ts       # Cart state
```

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Run production server
npm run lint         # Check code quality
npm run type-check   # Check TypeScript
```

## Features Summary

✅ Customer ordering with customization
✅ Shopping cart with real-time calculation
✅ Multiple dashboards (Barista, Cashier, Manager, Admin)
✅ Role-based access control
✅ Real-time order queue
✅ Sticker printing
✅ Inventory management
✅ Sales reporting
✅ Audit logging
✅ Multi-location support
✅ Mobile responsive

## Support

Stuck? Check these resources:
- **Next.js**: https://nextjs.org/docs
- **Supabase**: https://supabase.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs

---

🚀 **You're all set!** Start exploring the application at http://localhost:3000
