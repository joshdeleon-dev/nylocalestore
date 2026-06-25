# Deployment Guide - NY Locale Store

## Prerequisites

- Node.js 18+ installed locally
- npm or yarn package manager
- Git and GitHub account
- Supabase account (free tier available at https://supabase.com)
- Vercel account (free tier available at https://vercel.com)
- Custom domain (nylocalestore.com recommended)

## Step-by-Step Deployment

### Phase 1: Supabase Setup

#### 1.1 Create Supabase Project
1. Go to https://supabase.com
2. Sign up or log in to your account
3. Click "New Project"
4. Configure:
   - Project Name: "NY Locale Store"
   - Database Password: Use a strong password
   - Region: Choose closest to your target market
5. Wait for project initialization (3-5 minutes)

#### 1.2 Get API Keys
1. In Supabase dashboard, go to **Settings** → **API**
2. Copy and save:
   - `Project URL` - NEXT_PUBLIC_SUPABASE_URL
   - `anon public` key - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - `service_role` key - SUPABASE_SERVICE_ROLE_KEY (keep this secret!)

#### 1.3 Run Database Migrations
1. In your local project, set up Supabase CLI:
   ```bash
   npm install -g supabase
   supabase login
   ```

2. Link your project:
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
   (Find project ref in Supabase dashboard URL: supabase.com/project/`<PROJECT-REF>`)

3. Push migrations:
   ```bash
   supabase db push
   ```

4. Alternatively, run SQL manually in Supabase SQL Editor:
   - Copy contents of `supabase/migrations/001_init_schema.sql`
   - Paste into Supabase SQL Editor
   - Click Execute
   - Repeat for `002_seed_data.sql`

#### 1.4 Enable Row Level Security (RLS)
In Supabase SQL Editor, run:
```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create basic policies (adjust as needed for your auth setup)
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);
```

### Phase 2: Local Setup & Testing

#### 2.1 Clone or Initialize Repository
```bash
cd "NY Locale Store v2"
```

#### 2.2 Install Dependencies
```bash
npm install
```

#### 2.3 Create Environment File
```bash
cp .env.example .env.local
```

#### 2.4 Configure Environment Variables
Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_API_URL=http://localhost:3000
```

#### 2.5 Test Locally
```bash
npm run dev
```

Open http://localhost:3000 and verify:
- [ ] Menu loads correctly
- [ ] Can add items to cart
- [ ] Cart calculations are correct
- [ ] Can proceed through checkout
- [ ] Order is created successfully
- [ ] Confirmation page displays

### Phase 3: GitHub Setup

#### 3.1 Initialize Git Repository
```bash
git init
git add .
git commit -m "Initial commit: NY Locale Store full-stack app"
```

#### 3.2 Push to GitHub
1. Create new repository on GitHub (https://github.com/new)
   - Repository name: `ny-locale-store`
   - Description: "Modern full-stack coffee shop ordering platform"
   - Private or Public (your choice)

2. Push code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/ny-locale-store.git
   git branch -M main
   git push -u origin main
   ```

### Phase 4: Vercel Deployment

#### 4.1 Connect to Vercel
1. Visit https://vercel.com/new
2. Select "GitHub"
3. Authenticate with GitHub
4. Select `ny-locale-store` repository
5. Click "Import"

#### 4.2 Configure Project Settings
1. **Framework Preset**: Next.js (auto-detected)
2. **Build & Development Settings**:
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Node.js Version: `18.x`

#### 4.3 Set Environment Variables
In Vercel deployment settings, add:
```
NEXT_PUBLIC_SUPABASE_URL = <your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <your-anon-key>
SUPABASE_SERVICE_ROLE_KEY = <your-service-role-key>
NEXT_PUBLIC_API_URL = https://order.nylocalestore.com
```

#### 4.4 Deploy
Click "Deploy" and wait for completion (~3-5 minutes)

### Phase 5: Domain Configuration

#### 5.1 Purchase Domain (if needed)
Purchase `nylocalestore.com` from your registrar (GoDaddy, Namecheap, etc.)

#### 5.2 Configure DNS

##### Option A: Use Vercel's Nameservers (Recommended)
1. In Vercel Project Settings → Domains
2. Click "Add Domain"
3. Enter `order.nylocalestore.com`
4. Select "Using Vercel Nameservers"
5. Copy Vercel nameservers
6. Update your domain registrar's nameservers

##### Option B: Add CNAME Records (If keeping current registrar)
1. In Vercel Project Settings → Domains
2. Add domain and get CNAME records
3. In your registrar's DNS settings, add:
   - CNAME: `order` → `cname.vercel-dns.com`

#### 5.3 Verify Domain
1. Wait for DNS propagation (up to 48 hours)
2. In Vercel, domain should show "Valid Configuration"

#### 5.4 SSL Certificate
Vercel automatically provisions Let's Encrypt SSL certificates

### Phase 6: Production Verification

#### 6.1 Test Deployed Application
1. Visit https://order.nylocalestore.com
2. Verify all pages load correctly
3. Test order flow end-to-end
4. Check database connections

#### 6.2 Monitor Deployment
1. Enable Vercel Analytics
2. Set up error monitoring
3. Configure performance monitoring

### Phase 7: Continuous Deployment

#### 7.1 Auto-Deploy on Push
Vercel automatically deploys on:
- Pushes to `main` branch
- Pull request previews
- Merges to main

#### 7.2 Deployment Protection (Optional)
1. In Vercel Project Settings → Deployment Protection
2. Enable production deployment protection
3. Require approval for production deployments

## Maintenance & Updates

### Regular Tasks
- Monitor error logs in Vercel
- Update dependencies monthly
- Review usage and costs
- Backup Supabase data regularly

### Scaling Considerations
- Use Supabase database replicas for read-heavy operations
- Implement caching with Redis (future enhancement)
- Monitor database performance
- Scale Vercel plan as needed

### Monitoring & Analytics
- Enable Vercel Web Analytics
- Set up error tracking with Sentry (recommended)
- Configure log aggregation
- Monitor database performance

## Troubleshooting

### Common Issues

#### Deployment Fails
- Check environment variables are set correctly
- Verify build logs in Vercel
- Ensure all dependencies are listed in package.json

#### Database Connection Fails
- Verify NEXT_PUBLIC_SUPABASE_URL is correct
- Check SUPABASE_SERVICE_ROLE_KEY is valid
- Ensure database migrations ran successfully
- Check Supabase is not in maintenance mode

#### Domain Not Resolving
- Wait for DNS propagation (up to 48 hours)
- Verify nameservers are correct
- Clear browser cache
- Use nslookup to debug DNS

#### 500 Errors
- Check Vercel deployment logs
- Verify database connections
- Check API keys are valid
- Review server-side error logs

## Support & Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Post-Deployment Checklist

- [ ] Application loads without errors
- [ ] All pages are accessible
- [ ] Database queries return correct data
- [ ] Authentication works
- [ ] Order creation functions properly
- [ ] Images load correctly
- [ ] Forms validate correctly
- [ ] Mobile responsive design works
- [ ] Dark mode functions (if enabled)
- [ ] Performance metrics are acceptable
- [ ] SSL certificate is active
- [ ] Domain is properly configured
- [ ] Backups are configured
- [ ] Monitoring is set up
- [ ] Error logging is active

## Next Steps After Deployment

1. **User Testing**: Have actual baristas/cashiers test the system
2. **Fine-tuning**: Adjust based on feedback
3. **Additional Features**: Implement thermal printer integration
4. **Training**: Train staff on using all dashboards
5. **Go Live**: Launch to customers

## Security Checklist

- [ ] Environment variables secured (not in code)
- [ ] SUPABASE_SERVICE_ROLE_KEY never exposed
- [ ] HTTPS enforced on all domains
- [ ] RLS policies configured
- [ ] Rate limiting implemented
- [ ] Input validation in place
- [ ] CORS properly configured
- [ ] Regular security updates scheduled

---

For questions or issues during deployment, refer to the main README.md or contact the development team.
