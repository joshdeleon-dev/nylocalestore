import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import { categorySchema, firstZodError, slugify } from '@/lib/marketplace';
import { audit, db } from '@/lib/marketplaceServer';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await db
    .from('marketplace_categories')
    .select('*, listings:marketplace_listings(count)')
    .order('sort_order')
    .order('name');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const categories = (data ?? []).map(({ listings, ...c }: any) => ({ ...c, listing_count: listings?.[0]?.count ?? 0 }));
  return NextResponse.json({ success: true, data: categories });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const parsed = categorySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstZodError(parsed.error) }, { status: 400 });

  const { data, error } = await db
    .from('marketplace_categories')
    .insert({ ...parsed.data, slug: slugify(parsed.data.name) })
    .select()
    .single();
  if (error) {
    const msg = error.code === '23505' ? 'A category with that name already exists' : error.message;
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }

  await audit(auth.id, 'category', data.id, 'create', null, data);
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const { id, ...body } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
  const parsed = categorySchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: firstZodError(parsed.error) }, { status: 400 });

  const { data: before } = await db.from('marketplace_categories').select('*').eq('id', id).single();
  if (!before) return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });

  const updates: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (parsed.data.name) updates.slug = slugify(parsed.data.name);

  const { data, error } = await db.from('marketplace_categories').update(updates).eq('id', id).select().single();
  if (error) {
    const msg = error.code === '23505' ? 'A category with that name already exists' : error.message;
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }

  await audit(auth.id, 'category', id, 'update', before, data);
  return NextResponse.json({ success: true, data });
}

// Categories in use are hidden (deactivated) rather than deleted, so listings keep their category
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  const { data: before } = await db.from('marketplace_categories').select('*').eq('id', id).single();
  if (!before) return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });

  const { count } = await db.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('category_id', id);
  if ((count ?? 0) > 0) {
    await db.from('marketplace_categories').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
    await audit(auth.id, 'category', id, 'deactivate', before, { ...before, is_active: false });
    return NextResponse.json({ success: true, deactivated: true });
  }

  const { error } = await db.from('marketplace_categories').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  await audit(auth.id, 'category', id, 'delete', before, null);
  return NextResponse.json({ success: true, deleted: true });
}
