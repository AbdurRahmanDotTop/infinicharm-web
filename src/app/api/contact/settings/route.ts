import { NextResponse } from 'next/server';
import { getContactSettings } from '@/lib/server/contact-settings-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const settings = getContactSettings();
  return NextResponse.json({ success: true, settings });
}
