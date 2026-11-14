import { NextRequest, NextResponse } from 'next/server';
import {
  getServerPaymentGateways,
  getPublicStorefrontGateways,
  upsertServerPaymentGateway,
  deleteServerPaymentGateway,
} from '@/lib/server/gateways-store';
import { PaymentGatewayConfig } from '@/types';

function isAuthorizedAdmin(request: NextRequest): boolean {
  return request.cookies.get('infinicharm_admin_session')?.value === 'active';
}

// ==============================================================================
// InfiniCharm — Central Payment Gateway Configuration & Synchronization API
// Governing PRD: PRD 09 (Payment Architecture & Admin Authority)
// Invariants: Server Authority, Real Data, Masked Secrets, Instant Propagation
// ==============================================================================

/**
 * Mask sensitive credentials for administrative display
 */
function maskGatewaySecrets(gw: PaymentGatewayConfig): PaymentGatewayConfig {
  const creds = { ...gw.credentials };
  if (creds.keySecret && creds.keySecret.length > 4) {
    creds.keySecret = '••••••••••••••••••••••••';
  }
  if (creds.saltKey && creds.saltKey.length > 4) {
    creds.saltKey = '••••••••••••••••••••••••';
  }
  if (creds.webhookSecret && creds.webhookSecret.length > 4) {
    creds.webhookSecret = '••••••••••••••••';
  }
  return { ...gw, credentials: creds };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === 'true';

    if (isPublic) {
      // Public storefront checkout: only active/enabled gateways, zero secret leakage
      const publicGateways = getPublicStorefrontGateways();
      return NextResponse.json(
        { success: true, gateways: publicGateways },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
    }

    if (!isAuthorizedAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin privileges required.' },
        { status: 401 }
      );
    }

    // Admin endpoint: return all gateways (with masked secrets)
    const all = getServerPaymentGateways();
    const masked = all.map(maskGatewaySecrets);

    return NextResponse.json(
      { success: true, gateways: masked },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('Failed to fetch payment gateways:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to retrieve gateways.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isAuthorizedAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin privileges required.' },
        { status: 401 }
      );
    }
    const updatedGateway: PaymentGatewayConfig = await request.json();

    if (!updatedGateway || !updatedGateway.id) {
      return NextResponse.json(
        { success: false, error: 'Invalid gateway payload: missing ID.' },
        { status: 400 }
      );
    }

    // Preserve existing real secrets if masked string was sent back from client
    const currentList = getServerPaymentGateways();
    const existing = currentList.find((g) => g.id === updatedGateway.id);

    if (existing) {
      if (
        updatedGateway.credentials.keySecret === '••••••••••••••••••••••••' ||
        !updatedGateway.credentials.keySecret
      ) {
        updatedGateway.credentials.keySecret = existing.credentials.keySecret;
      }
      if (
        updatedGateway.credentials.saltKey === '••••••••••••••••••••••••' ||
        !updatedGateway.credentials.saltKey
      ) {
        updatedGateway.credentials.saltKey = existing.credentials.saltKey;
      }
      if (
        updatedGateway.credentials.webhookSecret === '••••••••••••••••' ||
        !updatedGateway.credentials.webhookSecret
      ) {
        updatedGateway.credentials.webhookSecret = existing.credentials.webhookSecret;
      }
    }

    const updatedList = upsertServerPaymentGateway(updatedGateway);

    return NextResponse.json(
      {
        success: true,
        message: `${updatedGateway.name} updated successfully.`,
        gateways: updatedList.map(maskGatewaySecrets),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('Failed to update payment gateway:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update gateway.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin privileges required.' },
        { status: 401 }
      );
    }
    const newGateway: PaymentGatewayConfig = await request.json();

    if (!newGateway || !newGateway.id || !newGateway.name) {
      return NextResponse.json(
        { success: false, error: 'Gateway ID and Name are required.' },
        { status: 400 }
      );
    }

    // Mark as custom gateway
    const gatewayToSave: PaymentGatewayConfig = {
      ...newGateway,
      id: newGateway.id.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
      isCustom: true,
      lastTestedAt: new Date().toISOString(),
    };

    const updatedList = upsertServerPaymentGateway(gatewayToSave);

    return NextResponse.json(
      {
        success: true,
        message: `Custom gateway ${gatewayToSave.name} created successfully.`,
        gateways: updatedList.map(maskGatewaySecrets),
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Failed to create custom payment gateway:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create gateway.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isAuthorizedAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin privileges required.' },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Gateway ID is required.' },
        { status: 400 }
      );
    }

    const res = deleteServerPaymentGateway(id);

    if (!res.success) {
      return NextResponse.json(
        { success: false, error: res.message || 'Cannot delete gateway.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Gateway ${id} deleted successfully.`,
      gateways: res.list.map(maskGatewaySecrets),
    });
  } catch (err: any) {
    console.error('Failed to delete payment gateway:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete gateway.' },
      { status: 500 }
    );
  }
}

