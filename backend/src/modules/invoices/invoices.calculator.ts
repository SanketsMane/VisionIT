import { DiscountType, Prisma } from '@prisma/client';

import Decimal = Prisma.Decimal;
import { add, divide, multiply, round2, subtract, toDecimal, type Numeric } from '@utils/money.util';

export interface LineInput {
  title: string;
  description?: string | null;
  hsnSac?: string | null;
  quantity: Numeric;
  unit?: string;
  unitPrice: Numeric;
  discountPercent?: Numeric;
  taxRate?: Numeric;
  sortOrder?: number;
}

export interface CalculatedLine extends Omit<LineInput, 'quantity' | 'unitPrice' | 'discountPercent' | 'taxRate'> {
  quantity: Decimal;
  unitPrice: Decimal;
  discountPercent: Decimal;
  taxRate: Decimal;
  /** Line value after the per-line discount, before tax. */
  netAmount: Decimal;
  taxAmount: Decimal;
  lineTotal: Decimal;
  sortOrder: number;
}

export interface TotalsInput {
  lines: LineInput[];
  discountType?: DiscountType;
  discountValue?: Numeric;
  shippingAmount?: Numeric;
  /** When true, `unitPrice` already includes tax and is back-calculated. */
  taxInclusive?: boolean;
  /** Splits tax into CGST+SGST (intra-state) vs IGST (inter-state). */
  isInterState?: boolean;
  roundOffTotal?: boolean;
}

export interface TaxBreakdownRow {
  rate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface CalculatedTotals {
  lines: CalculatedLine[];
  subtotal: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  shippingAmount: Decimal;
  roundOff: Decimal;
  total: Decimal;
  taxBreakdown: TaxBreakdownRow[];
}

/**
 * Turns raw line input into fully priced lines.
 *
 * Order of operations matters and is fixed here so the API, the PDF and the
 * frontend preview can never disagree:
 *   gross → per-line discount → net → tax → line total.
 *
 * With `taxInclusive`, the entered price is treated as tax-inclusive and the
 * net is back-calculated as `gross / (1 + rate/100)`.
 */
export const calculateLines = (lines: LineInput[], taxInclusive = false): CalculatedLine[] =>
  lines.map((line, index) => {
    const quantity = toDecimal(line.quantity);
    const unitPrice = toDecimal(line.unitPrice);
    const discountPercent = toDecimal(line.discountPercent ?? 0);
    const taxRate = toDecimal(line.taxRate ?? 0);

    const gross = multiply(quantity, unitPrice);
    const afterDiscount = subtract(gross, multiply(gross, divide(discountPercent, 100)));

    const netAmount = taxInclusive
      ? round2(divide(afterDiscount, add(1, divide(taxRate, 100))))
      : round2(afterDiscount);

    const taxAmount = round2(multiply(netAmount, divide(taxRate, 100)));

    return {
      title: line.title,
      description: line.description ?? null,
      hsnSac: line.hsnSac ?? null,
      unit: line.unit ?? 'nos',
      quantity,
      unitPrice,
      discountPercent,
      taxRate,
      netAmount,
      taxAmount,
      lineTotal: round2(add(netAmount, taxAmount)),
      sortOrder: line.sortOrder ?? index,
    };
  });

/**
 * Groups tax by rate for the statutory summary table on the invoice.
 * Intra-state supply splits each rate in half across CGST and SGST; inter-state
 * supply puts the whole amount under IGST.
 */
export const buildTaxBreakdown = (
  lines: CalculatedLine[],
  isInterState: boolean,
): TaxBreakdownRow[] => {
  const byRate = new Map<string, { taxable: Decimal; tax: Decimal }>();

  for (const line of lines) {
    if (line.taxRate.isZero()) continue;
    const key = line.taxRate.toFixed(3);
    const current = byRate.get(key) ?? { taxable: toDecimal(0), tax: toDecimal(0) };
    byRate.set(key, {
      taxable: current.taxable.plus(line.netAmount),
      tax: current.tax.plus(line.taxAmount),
    });
  }

  return [...byRate.entries()]
    .map(([rate, sums]) => {
      const half = round2(divide(sums.tax, 2));
      return {
        rate: Number(rate),
        taxableAmount: round2(sums.taxable).toNumber(),
        cgst: isInterState ? 0 : half.toNumber(),
        // The second half absorbs any odd paisa so cgst + sgst === total tax.
        sgst: isInterState ? 0 : round2(subtract(sums.tax, half)).toNumber(),
        igst: isInterState ? round2(sums.tax).toNumber() : 0,
        total: round2(sums.tax).toNumber(),
      };
    })
    .sort((a, b) => a.rate - b.rate);
};

/**
 * Computes every monetary field on an invoice.
 *
 * The invoice-level discount is applied *after* line tax has been computed and
 * is therefore treated as a settlement discount on the gross amount, not a
 * re-basing of the tax. That keeps the tax figures on the document consistent
 * with what was actually charged per line.
 */
export const calculateTotals = (input: TotalsInput): CalculatedTotals => {
  const lines = calculateLines(input.lines, input.taxInclusive ?? false);

  const subtotal = round2(add(...lines.map((l) => l.netAmount)));
  const taxAmount = round2(add(...lines.map((l) => l.taxAmount)));
  const shippingAmount = round2(input.shippingAmount ?? 0);

  let discountAmount = toDecimal(0);
  const discountType = input.discountType ?? DiscountType.NONE;
  const discountValue = toDecimal(input.discountValue ?? 0);

  if (discountType === DiscountType.PERCENTAGE) {
    discountAmount = round2(multiply(subtotal, divide(discountValue, 100)));
  } else if (discountType === DiscountType.FIXED) {
    // Never let a fixed discount exceed the invoice value.
    discountAmount = round2(Decimal.min(discountValue, subtotal));
  }

  const beforeRounding = round2(
    add(subtract(subtotal, discountAmount), taxAmount, shippingAmount),
  );

  const rounded = input.roundOffTotal
    ? beforeRounding.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    : beforeRounding;
  const roundOff = round2(subtract(rounded, beforeRounding));

  return {
    lines,
    subtotal,
    discountAmount,
    taxAmount,
    shippingAmount,
    roundOff,
    total: round2(rounded),
    taxBreakdown: buildTaxBreakdown(lines, input.isInterState ?? false),
  };
};

/** Payment progress used to move an invoice between PARTIALLY_PAID and PAID. */
export const settlementState = (
  total: Numeric,
  amountPaid: Numeric,
): { balanceDue: Decimal; isFullySettled: boolean; isPartiallySettled: boolean } => {
  const balanceDue = round2(subtract(total, amountPaid));
  return {
    balanceDue,
    // A sub-paisa remainder counts as settled — it is a rounding artefact.
    isFullySettled: balanceDue.lessThanOrEqualTo(0.005),
    isPartiallySettled: balanceDue.greaterThan(0.005) && toDecimal(amountPaid).greaterThan(0),
  };
};
