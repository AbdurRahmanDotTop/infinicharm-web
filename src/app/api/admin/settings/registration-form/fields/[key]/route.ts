import { NextRequest, NextResponse } from 'next/server';
import {
  updateRegistrationFormField,
  deleteRegistrationFormField,
} from '@/lib/server/registration-form-store';

function verifyAdminSession(req: NextRequest) {
  const adminCookie = req.cookies.get('infinicharm_admin_session')?.value;
  return adminCookie === 'active';
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { key } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid update payload.' }, { status: 400 });
    }

    const result = updateRegistrationFormField(key, body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to update field.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      field: result.field,
      message: `Field "${result.field?.label}" updated successfully.`,
    });
  } catch (err: any) {
    console.error('[api/admin/settings/registration-form/fields/[key]] PUT error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update registration field.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { key } = await params;
    const result = deleteRegistrationFormField(key);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to delete field.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Field "${key}" was deleted successfully.`,
    });
  } catch (err: any) {
    console.error('[api/admin/settings/registration-form/fields/[key]] DELETE error:', err);
    return NextResponse.json({ success: false, error: 'Failed to delete registration field.' }, { status: 500 });
  }
}
