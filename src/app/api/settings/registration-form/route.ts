import { NextResponse } from 'next/server';
import { getPublicRegistrationFormSettings } from '@/lib/server/registration-form-store';

export async function GET() {
  try {
    const settings = getPublicRegistrationFormSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (err: any) {
    console.error('[api/settings/registration-form] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load registration form settings.' },
      { status: 500 }
    );
  }
}
