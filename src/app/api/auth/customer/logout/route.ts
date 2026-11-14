import { NextRequest, NextResponse } from 'next/server';
import {
  clearCustomerAuthCookies,
  logoutCustomerById,
} from '@/lib/server/auth-service';

export async function POST(req: NextRequest) {
  const customerId = req.cookies.get('infinicharm_customer_id')?.value;
  const sessionCookie = req.cookies.get('infinicharm_customer_session')?.value;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';

  if (customerId && sessionCookie === 'active') {
    logoutCustomerById(customerId, ipAddress);
  }

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully.',
  });
  clearCustomerAuthCookies(response);
  return response;
}
