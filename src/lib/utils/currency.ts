/**
 * Formats an amount in integer paise to an Indian Rupee string (e.g. 49900 -> "₹499.00").
 */
export function formatPaise(
  amountInPaise: number,
  options: { showDecimals?: boolean } = {}
): string {
  const { showDecimals = true } = options;
  if (!Number.isFinite(amountInPaise)) {
    return '₹0.00';
  }

  const rupees = amountInPaise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export const formatPaiseToRupees = formatPaise;

/**
 * Parses a rupee float string or number to integer paise (e.g. 499.50 -> 49950).
 */
export function rupeesToPaise(rupees: number | string): number {
  const num = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

