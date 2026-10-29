import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import { PaymentView, loadPaymentRows } from '@/lib/marketplaceServer';

const VIEWS: PaymentView[] = ['awaiting_buyer', 'awaiting_payout', 'sold'];

// ?view=awaiting_buyer (default) | awaiting_payout | sold
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const view = (new URL(req.url).searchParams.get('view') ?? 'awaiting_buyer') as PaymentView;
  if (!VIEWS.includes(view)) return NextResponse.json({ success: false, error: 'Unknown view' }, { status: 400 });

  try {
    return NextResponse.json({ success: true, data: await loadPaymentRows(view) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
