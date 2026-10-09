// Bank product catalog fixture (doc 04 §11). Values are demo data with explicit dates — not live offers.
// Money: integer Rupiah. Rates/ratios: basis points.

const ALL_OCCUPATIONS = ['private_employee', 'civil_servant', 'military_police', 'entrepreneur', 'professional', 'freelancer']
const ALL_PURPOSES = ['renovation', 'education', 'business', 'debt_consolidation', 'other']

export const BANK_PRODUCTS = [
  {
    id: 'bpr_abc_primary_fix5_v4',
    version: 4,
    bank: { id: 'bnk_abc', name: 'Bank ABC', mark: 'ABC' },
    name: 'KPR Fixed 5 Tahun',
    productTypes: ['primary'],
    scheme: 'conventional',
    status: 'published',
    effectiveFrom: '2026-09-01',
    effectiveUntil: '2026-12-31',
    lastVerifiedAt: '2026-09-27',
    ratePeriods: [
      { type: 'fixed', durationMonths: 60, rateBps: 550 },
      { type: 'floating', durationMonths: null, rateBps: 1050, estimated: true },
    ],
    fees: { provisionBps: 75, admin: 1_000_000 },
    eligibility: {
      minimumIncome: 5_000_000,
      maximumDtiBps: 4000,
      maximumLtvBps: 9000,
      minimumAge: 21,
      maximumAgeAtMaturity: 60,
      maximumTenorMonths: 360,
      occupations: ALL_OCCUPATIONS,
      propertyTypes: ['landed_house', 'apartment', 'shophouse'],
    },
  },
  {
    id: 'bpr_xyz_primary_fix3_v3',
    version: 3,
    bank: { id: 'bnk_xyz', name: 'Bank XYZ', mark: 'XYZ' },
    name: 'KPR Fixed 3 Tahun',
    productTypes: ['primary'],
    scheme: 'conventional',
    status: 'published',
    effectiveFrom: '2026-08-15',
    effectiveUntil: '2026-12-31',
    lastVerifiedAt: '2026-09-25',
    ratePeriods: [
      { type: 'fixed', durationMonths: 36, rateBps: 600 },
      { type: 'floating', durationMonths: null, rateBps: 1025, estimated: true },
    ],
    fees: { provisionBps: 50, admin: 1_500_000 },
    eligibility: {
      minimumIncome: 4_000_000,
      maximumDtiBps: 3500,
      maximumLtvBps: 8500,
      minimumAge: 21,
      maximumAgeAtMaturity: 65,
      maximumTenorMonths: 300,
      occupations: ALL_OCCUPATIONS,
      propertyTypes: ['landed_house', 'apartment'],
    },
  },
  {
    id: 'bpr_def_primary_fix10_v2',
    version: 2,
    bank: { id: 'bnk_def', name: 'Bank DEF', mark: 'DEF' },
    name: 'KPR Fixed 10 Tahun',
    productTypes: ['primary'],
    scheme: 'conventional',
    status: 'published',
    effectiveFrom: '2026-07-01',
    effectiveUntil: '2027-06-30',
    lastVerifiedAt: '2026-09-20',
    ratePeriods: [
      { type: 'fixed', durationMonths: 120, rateBps: 725 },
      { type: 'floating', durationMonths: null, rateBps: 1075, estimated: true },
    ],
    fees: { provisionBps: 100, admin: 750_000 },
    eligibility: {
      minimumIncome: 6_000_000,
      maximumDtiBps: 4500,
      maximumLtvBps: 9000,
      minimumAge: 21,
      maximumAgeAtMaturity: 65,
      maximumTenorMonths: 360,
      occupations: ['private_employee', 'civil_servant', 'military_police', 'professional'],
      propertyTypes: ['landed_house', 'apartment', 'shophouse'],
    },
  },
  {
    id: 'bpr_xyz_takeover_fix5_v3',
    version: 3,
    bank: { id: 'bnk_xyz', name: 'Bank XYZ', mark: 'XYZ' },
    name: 'Take Over Fixed 5 Tahun',
    productTypes: ['takeover'],
    scheme: 'conventional',
    status: 'published',
    effectiveFrom: '2026-09-01',
    effectiveUntil: '2026-12-31',
    lastVerifiedAt: '2026-09-28',
    ratePeriods: [
      { type: 'fixed', durationMonths: 60, rateBps: 650 },
      { type: 'floating', durationMonths: null, rateBps: 1025, estimated: true },
    ],
    fees: { provisionBps: 100, admin: 1_000_000, appraisal: 1_500_000, notary: 5_000_000, insurance: 850_000 },
    eligibility: { maximumDtiBps: 4000, maximumLtvBps: 8000, purposes: ALL_PURPOSES, maximumTenorMonths: 300 },
  },
  {
    id: 'bpr_def_takeover_fix3_v2',
    version: 2,
    bank: { id: 'bnk_def', name: 'Bank DEF', mark: 'DEF' },
    name: 'Take Over Fixed 3 Tahun',
    productTypes: ['takeover'],
    scheme: 'conventional',
    status: 'published',
    effectiveFrom: '2026-08-01',
    effectiveUntil: '2027-01-31',
    lastVerifiedAt: '2026-09-27',
    ratePeriods: [
      { type: 'fixed', durationMonths: 36, rateBps: 575 },
      { type: 'floating', durationMonths: null, rateBps: 1075, estimated: true },
    ],
    fees: { provisionBps: 125, admin: 750_000, appraisal: 1_250_000, notary: 4_500_000, insurance: 900_000 },
    eligibility: { maximumDtiBps: 3500, maximumLtvBps: 7500, purposes: ['renovation', 'education', 'other'], maximumTenorMonths: 300 },
  },
  {
    id: 'bpr_ghi_takeover_fix10_v1',
    version: 1,
    bank: { id: 'bnk_ghi', name: 'Bank GHI', mark: 'GHI' },
    name: 'Take Over Fixed 10 Tahun',
    productTypes: ['takeover'],
    scheme: 'conventional',
    status: 'published',
    effectiveFrom: '2026-06-01',
    effectiveUntil: '2026-12-31',
    lastVerifiedAt: '2026-08-14',
    ratePeriods: [
      { type: 'fixed', durationMonths: 120, rateBps: 775 },
      { type: 'floating', durationMonths: null, rateBps: 1050, estimated: true },
    ],
    fees: { provisionBps: 75, admin: 1_500_000, appraisal: 1_500_000, notary: 5_500_000, insurance: 1_200_000 },
    eligibility: { maximumDtiBps: 4500, maximumLtvBps: 7000, purposes: ALL_PURPOSES, maximumTenorMonths: 300 },
  },
]

// Old-bank exit cost policy used when the user does not know the official figures (labelled "estimasi").
export const OLD_BANK_POLICY = { penaltyBps: 200, admin: 1_000_000 }

// Product data older than this is flagged stale and loses the recommendation label (PRD §21).
export const STALE_AFTER_DAYS = 30

// Payment-capacity guidance ratio (PRD §9.7: configurable, not a universal truth).
export const CAPACITY_RATIO_BPS = 3500
