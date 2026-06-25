import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

// Modifiers permissions to seed if missing
const MODIFIER_PERMISSIONS = [
  { name: 'modifiers:view', description: 'View modifier groups and modifiers', resource: 'modifiers', action: 'read' },
  { name: 'modifiers:create', description: 'Create modifier groups and modifiers', resource: 'modifiers', action: 'create' },
  { name: 'modifiers:update', description: 'Edit modifier groups and modifiers', resource: 'modifiers', action: 'update' },
  { name: 'modifiers:delete', description: 'Delete modifier groups and modifiers', resource: 'modifiers', action: 'delete' },
];

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.slice(7);
  if (!token) return null;
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('users').select('*, role:roles(name)').eq('id', user.id).single();
  const role = (profile as any)?.role?.name;
  if (role !== 'ADMIN') return null;
  return user;
}

// Ensure modifiers permissions exist and are assigned to MANAGER + BARISTA
async function seedModifierPermissions() {
  const { data: existing } = await db.from('permissions').select('id, name').like('name', 'modifiers:%');
  const existingNames = (existing || []).map((p: any) => p.name);
  const missing = MODIFIER_PERMISSIONS.filter((p) => !existingNames.includes(p.name));

  if (missing.length === 0) return; // All modifier permissions already seeded

  // Insert missing permissions
  const { data: inserted } = await db.from('permissions').insert(missing).select('id, name');
  const allModifierPerms = [...(existing || []), ...(inserted || [])];

  // Seed role_permissions for MANAGER (id=2) and BARISTA (id=3)
  const roleIds = [2, 3]; // MANAGER, BARISTA
  const assignments: { role_id: number; permission_id: number }[] = [];
  for (const roleId of roleIds) {
    for (const perm of allModifierPerms) {
      assignments.push({ role_id: roleId, permission_id: perm.id });
    }
  }
  if (assignments.length > 0) {
    // Only insert ones that don't already exist
    const permIds = allModifierPerms.map((p: any) => p.id);
    const { data: existingAssignments } = await db
      .from('role_permissions')
      .select('role_id, permission_id')
      .in('role_id', roleIds)
      .in('permission_id', permIds);

    const existingSet = new Set(
      (existingAssignments || []).map((a: any) => `${a.role_id}:${a.permission_id}`)
    );
    const toInsert = assignments.filter((a) => !existingSet.has(`${a.role_id}:${a.permission_id}`));
    if (toInsert.length > 0) {
      await db.from('role_permissions').insert(toInsert);
    }
  }
}

// GET — fetch all roles, permissions, and current assignments
export async function GET(req: NextRequest) {
  try {
    await seedModifierPermissions();

    const [rolesRes, permissionsRes, assignmentsRes] = await Promise.all([
      db.from('roles').select('id, name, description').order('id'),
      db.from('permissions').select('id, name, resource, action, description').order('id'),
      db.from('role_permissions').select('role_id, permission_id'),
    ]);

    if (rolesRes.error) throw rolesRes.error;
    if (permissionsRes.error) throw permissionsRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;

    return NextResponse.json({
      success: true,
      roles: rolesRes.data || [],
      permissions: permissionsRes.data || [],
      assignments: assignmentsRes.data || [],
    });
  } catch (error: any) {
    console.error('Error fetching roles/permissions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — assign a permission to a role
export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { role_id, permission_id } = await req.json();
    if (!role_id || !permission_id) {
      return NextResponse.json({ error: 'role_id and permission_id required' }, { status: 400 });
    }

    const { data, error } = await db
      .from('role_permissions')
      .insert({ role_id, permission_id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: true, already_exists: true });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error adding permission:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — remove a permission from a role
export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const role_id = searchParams.get('role_id');
    const permission_id = searchParams.get('permission_id');
    if (!role_id || !permission_id) {
      return NextResponse.json({ error: 'role_id and permission_id required' }, { status: 400 });
    }

    const { error } = await db
      .from('role_permissions')
      .delete()
      .eq('role_id', parseInt(role_id))
      .eq('permission_id', parseInt(permission_id));

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing permission:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
