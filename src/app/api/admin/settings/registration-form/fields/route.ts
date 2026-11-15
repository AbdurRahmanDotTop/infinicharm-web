import { NextRequest, NextResponse } from 'next/server';
import { addRegistrationFormField } from '@/lib/server/registration-form-store';

function verifyAdminSession(req: NextRequest) {
  const adminCookie = req.cookies.get('infinicharm_admin_session')?.value;
  return adminCookie === 'active';
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.key || !body.label || !body.type) {
      return NextResponse.json(
        { success: false, error: 'Key, Label, and Type are required for new registration fields.' },
        { status: 400 }
      );
    }

    const result = addRegistrationFormField(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to add field.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      field: result.field,
      message: `Field "${result.field?.label}" created successfully.`,
    }, { status: 201 });
  } catch (err: any) {
    console.error('[api/admin/settings/registration-form/fields] POST error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create registration field.' }, { status: 500 });
  }
}
