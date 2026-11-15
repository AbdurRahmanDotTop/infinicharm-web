import { NextRequest, NextResponse } from 'next/server';
import {
  getRegistrationFormSettings,
  saveRegistrationFormSettings,
} from '@/lib/server/registration-form-store';

function verifyAdminSession(req: NextRequest) {
  const adminCookie = req.cookies.get('infinicharm_admin_session')?.value;
  return adminCookie === 'active';
}

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const settings = getRegistrationFormSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    console.error('[api/admin/settings/registration-form] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load registration form configuration.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid settings payload.' }, { status: 400 });
    }

    const success = saveRegistrationFormSettings(body);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to save registration form configuration.' }, { status: 500 });
    }

    const updated = getRegistrationFormSettings();
    return NextResponse.json({
      success: true,
      settings: updated,
      message: 'Registration form configuration saved successfully.',
    });
  } catch (err: any) {
    console.error('[api/admin/settings/registration-form] PUT error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update registration form configuration.' },
      { status: 500 }
    );
  }
}
