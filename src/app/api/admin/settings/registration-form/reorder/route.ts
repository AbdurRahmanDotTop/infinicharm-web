import { NextRequest, NextResponse } from 'next/server';
import { reorderRegistrationFormFields } from '@/lib/server/registration-form-store';

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
    if (!body || !Array.isArray(body.keys)) {
      return NextResponse.json(
        { success: false, error: 'Array of field keys is required.' },
        { status: 400 }
      );
    }

    const result = reorderRegistrationFormFields(body.keys);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to reorder fields.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      fields: result.fields,
      message: 'Registration fields reordered successfully.',
    });
  } catch (err: any) {
    console.error('[api/admin/settings/registration-form/reorder] POST error:', err);
    return NextResponse.json({ success: false, error: 'Failed to reorder fields.' }, { status: 500 });
  }
}
