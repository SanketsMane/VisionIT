import { Prisma } from '@prisma/client';
import { ApiError } from '@utils/api-error';
import { toNumber } from '@utils/money.util';

/**
 * Volume pricing: spend more, pay less per unit.
 *
 * The client types an amount and we work out what it buys. Doing that here
 * rather than in the browser means the figure written on an order is one the
 * server chose — the calculator on screen is a preview, and a tampered request
 * cannot buy 100,000 SMS for ₹1.
 */

export interface Slab {
  minAmount: Prisma.Decimal;
  maxAmount: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal;
  validityLabel: string | null;
}

export interface SlabQuote {
  amount: number;
  unitPrice: number;
  quantity: number;
  validityLabel: string | null;
  /** What the next band would give, so the UI can nudge without inventing it. */
  nextTier: { atAmount: number; unitPrice: number; validityLabel: string | null } | null;
}

/** The band an amount falls into. Bands are inclusive of their floor. */
export const findSlab = (slabs: Slab[], amount: number): Slab | null => {
  const ordered = [...slabs].sort((a, b) => toNumber(a.minAmount) - toNumber(b.minAmount));
  let match: Slab | null = null;
  for (const slab of ordered) {
    const min = toNumber(slab.minAmount);
    const max = slab.maxAmount ? toNumber(slab.maxAmount) : Infinity;
    if (amount >= min && amount <= max) match = slab;
  }
  return match;
};

export const quoteForAmount = (
  slabs: Slab[],
  amount: number,
  minOrderAmount: number | null,
): SlabQuote => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest('Enter an amount');
  }
  if (minOrderAmount && amount < minOrderAmount) {
    throw ApiError.badRequest(
      `The minimum top-up is ₹${minOrderAmount.toLocaleString('en-IN')}`,
    );
  }

  const slab = findSlab(slabs, amount);
  if (!slab) throw ApiError.badRequest('That amount is outside our pricing');

  const unitPrice = toNumber(slab.unitPrice);
  // Floored, not rounded: promising 2,353 credits and delivering 2,352 is the
  // kind of small lie that costs a support ticket.
  const quantity = Math.floor(amount / unitPrice);

  const ordered = [...slabs].sort((a, b) => toNumber(a.minAmount) - toNumber(b.minAmount));
  const next = ordered.find((s) => toNumber(s.minAmount) > amount) ?? null;

  return {
    amount: Math.round(amount),
    unitPrice,
    quantity,
    validityLabel: slab.validityLabel,
    nextTier: next
      ? {
          atAmount: toNumber(next.minAmount),
          unitPrice: toNumber(next.unitPrice),
          validityLabel: next.validityLabel,
        }
      : null,
  };
};
