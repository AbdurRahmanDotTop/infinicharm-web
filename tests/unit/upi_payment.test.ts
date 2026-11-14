import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatUpiTransactionNote,
  generateUpiIntentUri,
  generateUpiPaymentDetails,
  generateCheckoutOrderNumber,
  parseUtrInput,
  NPCI_UPI_SINGLE_TRANSACTION_LIMIT_PAISE,
  BANK_UPI_ADVISORY_THRESHOLD_PAISE,
  DEFAULT_UPI_CREDENTIALS,
} from '../../src/lib/services/upi.ts';

describe('Centralized UPI Payment & Dynamic Intent Engine (PRD 09)', () => {
  it('formats transaction note strictly with InfiniCharm Order prefix and dynamic Order ID', () => {
    const note1 = formatUpiTransactionNote('INF-202611-4821');
    assert.strictEqual(note1, 'InfiniCharm Order - INF-202611-4821');

    const note2 = formatUpiTransactionNote('IC-ORD-12345');
    assert.strictEqual(note2, 'InfiniCharm Order - IC-ORD-12345');

    const noteEmpty = formatUpiTransactionNote('');
    assert.strictEqual(noteEmpty, 'InfiniCharm Order');
  });

  it('generates fully compliant NPCI UPI deep links with required parameters and encoding', () => {
    const uri = generateUpiIntentUri({
      upiId: 'AbdurRahmanIndusIndCurrent@ybl',
      payeeName: 'TechilyFly - InfiniCharm',
      amountInRupees: '330.00',
      orderId: 'INF-202611-9999',
    });

    assert.ok(uri.startsWith('upi://pay?'), 'URI must start with upi://pay?');
    assert.ok(uri.includes('pa=AbdurRahmanIndusIndCurrent%40ybl'), 'pa parameter must be URL-encoded');
    assert.ok(uri.includes('pn=TechilyFly%20-%20InfiniCharm'), 'pn parameter must be URL-encoded');
    assert.ok(uri.includes('am=330.00'), 'am parameter must have 2 decimal places');
    assert.ok(uri.includes('cu=INR'), 'cu parameter must be INR');
    assert.ok(
      uri.includes('tn=InfiniCharm%20Order%20-%20INF-202611-9999'),
      'tn parameter must embed the dynamic Order ID'
    );
    assert.ok(
      uri.includes('tr=INF-202611-9999'),
      'tr parameter must carry the dynamic transaction reference'
    );
  });

  it('generates app-specific UPI deep links for PhonePe, GPay, Paytm, BHIM and Cred', () => {
    const details = generateUpiPaymentDetails({
      totalInPaise: 36000,
      orderId: 'INF-202611-7777',
    });

    assert.ok(details.appUris.phonePe.startsWith('phonepe://pay?'));
    assert.ok(details.appUris.gPay.startsWith('tez://upi/pay?'));
    assert.ok(details.appUris.paytm.startsWith('paytmmp://pay?'));
    assert.ok(details.appUris.bhim.startsWith('bhim://pay?'));
    assert.ok(details.appUris.cred.startsWith('cred://pay?'));
    assert.ok(details.appUris.phonePe.includes('am=360.00'));
  });

  it('generates universal shareable HTTPS payment link and friendly WhatsApp share URL', () => {
    const details = generateUpiPaymentDetails({
      totalInPaise: 36000,
      orderId: 'INF-202611-7777',
    });

    assert.ok(
      details.shareablePaymentUrl.includes('/pay/INF-202611-7777'),
      'Shareable link must be an HTTPS URL pointing to /pay/[orderId]'
    );
    assert.ok(
      details.whatsAppShareUrl.startsWith('https://api.whatsapp.com/send?text='),
      'WhatsApp URL must be an official click-to-chat deep link'
    );
    assert.ok(
      decodeURIComponent(details.whatsAppShareUrl).includes('INF-202611-7777'),
      'WhatsApp message must mention the Order Reference'
    );
    assert.ok(
      decodeURIComponent(details.whatsAppShareUrl).includes('360.00'),
      'WhatsApp message must mention the exact amount'
    );
  });

  it('generates centralized payment details and shares identical URI for QR code and direct links', () => {
    const payment = generateUpiPaymentDetails({
      credentials: {
        upiId: 'AbdurRahmanIndusIndCurrent@ybl',
        payeeName: 'TechilyFly - InfiniCharm',
      },
      totalInPaise: 240000, // ₹2,400.00
      orderId: 'INF-202611-1234',
    });

    assert.strictEqual(payment.upiId, 'AbdurRahmanIndusIndCurrent@ybl');
    assert.strictEqual(payment.amountInRupees, '2400.00');
    assert.strictEqual(payment.orderId, 'INF-202611-1234');
    assert.strictEqual(payment.transactionNote, 'InfiniCharm Order - INF-202611-1234');
    assert.strictEqual(payment.isAmountExceedingLimit, false);
    assert.strictEqual(payment.isHighValueTransaction, false);
    assert.strictEqual(payment.limitWarningMessage, null);
    assert.ok(payment.upiIntentUri.includes('am=2400.00'));
  });

  it('detects high-value orders and issues appropriate bank advisory warning', () => {
    // ₹35,000 (3,500,000 paise)
    const highVal = generateUpiPaymentDetails({
      totalInPaise: 3500000,
      orderId: 'INF-202611-5555',
    });

    assert.strictEqual(highVal.isAmountExceedingLimit, false);
    assert.strictEqual(highVal.isHighValueTransaction, true);
    assert.ok(highVal.limitWarningMessage?.includes('Bank Daily Limit Advisory'));
  });

  it('detects orders exceeding the NPCI ₹1,00,000 UPI ceiling and alerts customer', () => {
    // ₹1,20,000 (12,000,000 paise)
    const overCeiling = generateUpiPaymentDetails({
      totalInPaise: 12000000,
      orderId: 'INF-202611-8888',
    });

    assert.strictEqual(overCeiling.isAmountExceedingLimit, true);
    assert.strictEqual(overCeiling.isHighValueTransaction, false);
    assert.ok(overCeiling.limitWarningMessage?.includes('NPCI UPI Transaction Limit Notice'));
  });

  it('validates and parses single 12-digit UTR input cleanly', () => {
    const single = parseUtrInput('431902847190');
    assert.strictEqual(single.isValid, true);
    assert.strictEqual(single.isSplitPayment, false);
    assert.deepStrictEqual(single.utrs, ['431902847190']);
    assert.strictEqual(single.error, null);
  });

  it('validates and parses multiple comma-separated UTRs for split payment support', () => {
    const split = parseUtrInput('431902847190, 431902847191');
    assert.strictEqual(split.isValid, true);
    assert.strictEqual(split.isSplitPayment, true);
    assert.deepStrictEqual(split.utrs, ['431902847190', '431902847191']);
    assert.strictEqual(split.error, null);
  });

  it('rejects malformed or truncated UTR inputs with helpful guidance', () => {
    const empty = parseUtrInput('');
    assert.strictEqual(empty.isValid, false);

    const tooShort = parseUtrInput('1234');
    assert.strictEqual(tooShort.isValid, false);
    assert.ok(tooShort.error?.includes('at least 10-16 alphanumeric characters'));
  });

  it('generates consistent order numbers adhering to standard INF-YYYYMM-XXXX format', () => {
    const orderNum = generateCheckoutOrderNumber();
    assert.match(orderNum, /^INF-\d{6}-\d{4}$/);
  });
});
