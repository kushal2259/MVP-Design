// ============================================================================
//  INDIA COST ENGINE — city-wise construction rates, GST, contractor-grade
//  BOQ quotation, and home-loan EMI calculator.
//  Rates are 2026 market approximations (₹) and are editable in the UI.
// ============================================================================

export interface CityRate {
  city: string;
  ratePerSqft: number; // turnkey standard-quality construction rate (₹/sqft)
}

const CITY_RATES: Record<string, CityRate> = {
  mumbai:    { city: 'Mumbai',    ratePerSqft: 3200 },
  delhi:     { city: 'Delhi NCR', ratePerSqft: 2500 },
  bangalore: { city: 'Bengaluru', ratePerSqft: 2300 },
  bengaluru: { city: 'Bengaluru', ratePerSqft: 2300 },
  pune:      { city: 'Pune',      ratePerSqft: 2150 },
  ahmedabad: { city: 'Ahmedabad', ratePerSqft: 1950 },
  hyderabad: { city: 'Hyderabad', ratePerSqft: 2050 },
  chennai:   { city: 'Chennai',   ratePerSqft: 2150 },
  kolkata:   { city: 'Kolkata',   ratePerSqft: 1950 },
  default:   { city: 'India avg', ratePerSqft: 2200 },
};

export type Tier = 'economy' | 'standard' | 'premium';
const TIER_MULT: Record<Tier, number> = { economy: 0.82, standard: 1.0, premium: 1.4 };

export function getCityRate(location: string): CityRate {
  const key = (location || '').toLowerCase();
  for (const k of Object.keys(CITY_RATES)) {
    if (k !== 'default' && key.includes(k)) return CITY_RATES[k];
  }
  return CITY_RATES.default;
}

export interface BOQLine {
  category: string;
  item: string;
  unit: string;
  qty: number;
  rate: number;     // ₹ per unit (incl. material+labour where applicable)
  gstPct: number;   // applicable GST %
  amount: number;   // qty * rate (pre-GST)
}

export interface CostBreakdown {
  city: string;
  ratePerSqft: number;     // effective rate for the chosen tier
  builtUpSqft: number;
  tier: Tier;
  boq: BOQLine[];
  subtotal: number;        // sum of amounts (pre-GST)
  gstAmount: number;
  total: number;           // subtotal + GST
  perSqftAllIn: number;
}

/**
 * Contractor-grade BOQ. Quantities are derived from built-up area using
 * standard Indian thumb-rules; rates scale with the quality tier and city.
 */
export function generateDetailedBOQ(builtUpSqft: number, location: string, tier: Tier = 'standard'): CostBreakdown {
  const cr = getCityRate(location);
  const m = TIER_MULT[tier];
  const a = builtUpSqft;
  // City factor relative to the India average (drives material+labour rates)
  const cf = cr.ratePerSqft / CITY_RATES.default.ratePerSqft;

  const r = (v: number) => Math.round(v * m * cf);

  const lines: BOQLine[] = [
    { category: 'Earthwork & Foundation', item: 'Excavation & PCC', unit: 'sq ft', qty: Math.round(a * 0.55), rate: r(55), gstPct: 18, amount: 0 },
    { category: 'Structure', item: 'RCC framework (M25) — columns, beams, slabs', unit: 'sq ft', qty: a, rate: r(360), gstPct: 18, amount: 0 },
    { category: 'Structure', item: 'TMT reinforcement steel (Fe500D)', unit: 'kg', qty: Math.round(a * 4.0), rate: r(72), gstPct: 18, amount: 0 },
    { category: 'Structure', item: 'OPC/PPC cement', unit: 'bags', qty: Math.round(a * 0.42), rate: r(420), gstPct: 28, amount: 0 },
    { category: 'Masonry', item: 'Brick/AAC block walls', unit: 'sq ft', qty: Math.round(a * 1.1), rate: r(120), gstPct: 18, amount: 0 },
    { category: 'Masonry', item: 'River/M-sand & aggregate', unit: 'cu ft', qty: Math.round(a * 1.85), rate: r(70), gstPct: 5, amount: 0 },
    { category: 'Finishes', item: 'Internal + external plaster & putty', unit: 'sq ft', qty: Math.round(a * 2.3), rate: r(38), gstPct: 18, amount: 0 },
    { category: 'Finishes', item: 'Vitrified tiles / flooring (supply+lay)', unit: 'sq ft', qty: Math.round(a * 1.15), rate: r(140), gstPct: 18, amount: 0 },
    { category: 'Finishes', item: 'Interior + exterior painting', unit: 'sq ft', qty: Math.round(a * 2.3), rate: r(34), gstPct: 18, amount: 0 },
    { category: 'Joinery', item: 'Doors (frames + shutters)', unit: 'nos', qty: Math.max(6, Math.round(a / 180)), rate: r(9500), gstPct: 18, amount: 0 },
    { category: 'Joinery', item: 'Windows (UPVC/aluminium + glazing)', unit: 'sq ft', qty: Math.round(a * 0.16), rate: r(520), gstPct: 18, amount: 0 },
    { category: 'MEP', item: 'Electrical wiring, points & DB (looping)', unit: 'sq ft', qty: a, rate: r(135), gstPct: 18, amount: 0 },
    { category: 'MEP', item: 'Plumbing, CPVC/uPVC, sanitary & fittings', unit: 'sq ft', qty: a, rate: r(120), gstPct: 18, amount: 0 },
    { category: 'Waterproofing', item: 'Terrace, toilets & sunken slabs', unit: 'sq ft', qty: Math.round(a * 0.35), rate: r(75), gstPct: 18, amount: 0 },
    { category: 'Labour', item: 'Skilled + unskilled labour (turnkey)', unit: 'sq ft', qty: a, rate: r(280), gstPct: 18, amount: 0 },
  ];

  lines.forEach(l => { l.amount = l.qty * l.rate; });

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const gstAmount = Math.round(lines.reduce((s, l) => s + l.amount * (l.gstPct / 100), 0));
  const total = subtotal + gstAmount;

  return {
    city: cr.city,
    ratePerSqft: Math.round(cr.ratePerSqft * m),
    builtUpSqft: a,
    tier,
    boq: lines,
    subtotal,
    gstAmount,
    total,
    perSqftAllIn: Math.round(total / a),
  };
}

// ── EMI / Home-loan calculator ──────────────────────────────────────────────
export interface EMIResult {
  principal: number;
  monthlyRate: number;
  months: number;
  emi: number;
  totalInterest: number;
  totalPayable: number;
}

export function calcEMI(principal: number, annualRatePct: number, years: number): EMIResult {
  const r = annualRatePct / 12 / 100;
  const n = years * 12;
  let emi: number;
  if (r === 0) emi = principal / n;
  else emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  emi = Math.round(emi);
  const totalPayable = emi * n;
  return {
    principal: Math.round(principal),
    monthlyRate: r,
    months: n,
    emi,
    totalInterest: Math.round(totalPayable - principal),
    totalPayable: Math.round(totalPayable),
  };
}

export function formatINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

/** CSV quotation export string (contractor-ready). */
export function boqToCSV(cb: CostBreakdown, projectName: string): string {
  const rows: string[] = [];
  rows.push(`Quotation — ${projectName}`);
  rows.push(`City,${cb.city},Tier,${cb.tier},Built-up (sq ft),${cb.builtUpSqft}`);
  rows.push('');
  rows.push('Category,Item,Unit,Quantity,Rate (INR),Amount (INR),GST %,GST Amount (INR),Line Total (INR)');
  cb.boq.forEach(l => {
    const gst = Math.round(l.amount * l.gstPct / 100);
    rows.push(`"${l.category}","${l.item}",${l.unit},${l.qty},${l.rate},${l.amount},${l.gstPct},${gst},${l.amount + gst}`);
  });
  rows.push('');
  rows.push(`,,,,Subtotal,${cb.subtotal},,,`);
  rows.push(`,,,,GST,,,${cb.gstAmount},`);
  rows.push(`,,,,GRAND TOTAL,,,,"${cb.total}"`);
  rows.push(`,,,,All-in rate / sq ft,,,,"${cb.perSqftAllIn}"`);
  return rows.join('\n');
}
