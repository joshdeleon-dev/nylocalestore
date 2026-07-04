import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured for user creation (missing service role key)' },
      { status: 500 }
    );
  }

  try {
    const { full_name, email, password, phone, group_number } = await req.json();

    if (!full_name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    if (!group_number || isNaN(Number(group_number)) || Number(group_number) < 1) {
      return NextResponse.json({ error: 'A valid group number is required' }, { status: 400 });
    }

    // Look up GROUP_LEADER role ID
    const { data: roleRow, error: roleError } = await db
      .from('roles')
      .select('id')
      .eq('name', 'GROUP_LEADER')
      .single();

    if (roleError || !roleRow) {
      return NextResponse.json({ error: 'GROUP_LEADER role not found — contact an administrator' }, { status: 500 });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered')) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
      }
      throw authError;
    }

    // Insert profile row
    const { error: profileError } = await db.from('users').insert({
      id: authData.user.id,
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      role_id: roleRow.id,
      phone: phone?.trim() || null,
      group_number: Number(group_number),
      is_active: true,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e: any) {
    console.error('Group leader signup error:', e);
    return NextResponse.json({ error: e.message || 'Signup failed' }, { status: 500 });
  }
}
