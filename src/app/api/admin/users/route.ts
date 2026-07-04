import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

async function verifyStaff(req: NextRequest) {
  const token = req.headers.get('authorization')?.slice(7);
  if (!token) return null;
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('users').select('*, role:roles(name)').eq('id', user.id).single();
  const role = (profile as any)?.role?.name;
  if (!['ADMIN', 'MANAGER'].includes(role)) return null;
  return user;
}

// Create a new staff user: creates auth account + profile row
export async function POST(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured for user creation (missing service role key)' }, { status: 500 });
  }

  try {
    const { full_name, email, password, role_id, location_id, phone, group_number } = await req.json();

    if (!full_name || !email || !password || !role_id) {
      return NextResponse.json({ error: 'Name, email, password, and role are required' }, { status: 400 });
    }

    // Step 1: create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw authError;

    // Step 2: insert profile row
    const { data, error: profileError } = await db.from('users').insert({
      id: authData.user.id,
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      role_id: Number(role_id),
      location_id: location_id || null,
      phone: phone?.trim() || null,
      group_number: group_number != null ? Number(group_number) : null,
      is_active: true,
    }).select('*, role:roles(name)').single();

    if (profileError) {
      // If profile insert fails, clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e: any) {
    console.error('Error creating user:', e);
    return NextResponse.json({ error: e.message || 'Failed to create user' }, { status: 500 });
  }
}

// Update user profile (name, role, active status) or change password
export async function PATCH(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id, password, ...profileUpdates } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Change password via Auth Admin API
    if (password) {
      if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Server not configured for password changes' }, { status: 500 });
      }
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
      if (pwError) throw pwError;

      // If only changing password, return early
      if (Object.keys(profileUpdates).length === 0) {
        return NextResponse.json({ success: true });
      }
    }

    // Update profile fields if any were provided
    if (Object.keys(profileUpdates).length > 0) {
      const { data, error } = await db.from('users').update(profileUpdates).eq('id', id).select('*, role:roles(name)').single();
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error updating user:', e);
    return NextResponse.json({ error: e.message || 'Failed to update user' }, { status: 500 });
  }
}

// Delete (hard-delete auth user, which cascades to profile)
export async function DELETE(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured for user deletion' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error deleting user:', e);
    return NextResponse.json({ error: e.message || 'Failed to delete user' }, { status: 500 });
  }
}
