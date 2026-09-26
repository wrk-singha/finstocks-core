import type {FundamentalsOwnership} from '../types/fundamentalsDetail.ts';

// The headline split, derived from the filing's own hierarchy rather than from
// a hand-picked list of category codes.
//
// SEBI files ownership as a tree: Promoter and Public at the top, Public split
// into Institutions and Non-institutions, and each of those split into the
// individual classes. The buckets below are cuts of that tree, so they are
// exhaustive by construction — Promoter + every cut of Public = GrandTotal —
// and no residual can appear for the reader to interpret.
//
// Only Institutions needs decomposing: the filing has no domestic/foreign head,
// so FII and Government are subtracted out and DII is whatever institutional
// money is left. Subtraction rather than addition is what keeps the total whole
// when the vendor files an institutional class nobody has named yet.
//
// Buckets and constituents come back as keys, not words: each app names them
// in its own copy.

export type OwnershipBucketKey =
  'promoter' | 'fii' | 'dii' | 'government' | 'public';

export interface OwnershipBucket {
  key: OwnershipBucketKey;
  pct: number;
}

export type DiiConstituentKey =
  'mutualFunds' | 'insurance' | 'banks' | 'pensionFunds' | 'alternativeFunds';

export interface OwnershipConstituent {
  key: DiiConstituentKey;
  code: string;
  pct: number;
}

const PROMOTER = 'Ftotalpromoter';
const INSTITUTIONS = 'INSubtotal';
const NON_INSTITUTIONS = 'NINSubtotal';
const FOREIGN_INSTITUTIONAL: readonly string[] = ['INFII', 'INForeignPortInv'];
const GOVERNMENT: readonly string[] = ['INcgovt', 'INDcgovt'];

// The order a stacked bar or a doughnut lays them out in.
const BUCKET_ORDER: readonly OwnershipBucketKey[] = [
  'promoter',
  'fii',
  'dii',
  'government',
  'public',
];

// The classes a reader expects to see named under DII, in filing order.
const DII_CONSTITUENTS: readonly {key: DiiConstituentKey; code: string}[] = [
  {key: 'mutualFunds', code: 'INMFUTI'},
  {key: 'insurance', code: 'INInsurance'},
  {key: 'banks', code: 'INFIBanks'},
  {key: 'pensionFunds', code: 'INProviPenFund'},
  {key: 'alternativeFunds', code: 'INAltInvFund'},
];

type ValueAt = (code: string) => number | null;

const valueAt = (ownership: FundamentalsOwnership, index: number): ValueAt => {
  const byCode = new Map(ownership.categories.map(c => [c.code, c]));
  return code => byCode.get(code)?.pct?.[index] ?? null;
};

const total = (at: ValueAt, codes: readonly string[]): number =>
  codes.reduce((sum, code) => sum + (at(code) ?? 0), 0);

const positive = (value: number): number =>
  Math.max(0, Number(value.toFixed(2)));

/**
 * The newest quarter a company filed a percentage for, or -1 when none did.
 * Quarters run newest-first, and a vendor row can carry share counts for a
 * quarter whose percentages have not landed yet.
 */
export const latestPctIndex = (ownership: FundamentalsOwnership): number =>
  ownership.quarters.findIndex((_, i) =>
    ownership.categories.some(c => c.pct?.[i] != null),
  );

/**
 * The quarter at `index` as promoter, FII, DII, government and public, in that
 * order, each to two decimals. A bucket the filing leaves empty is dropped
 * rather than drawn at zero.
 */
export const ownershipBuckets = (
  ownership: FundamentalsOwnership,
  index: number,
): OwnershipBucket[] => {
  const at = valueAt(ownership, index);
  const institutions = at(INSTITUTIONS);
  const fii = total(at, FOREIGN_INSTITUTIONAL);
  const government = total(at, GOVERNMENT);
  const pct: Record<OwnershipBucketKey, number> = {
    promoter: at(PROMOTER) ?? 0,
    fii,
    dii: institutions == null ? 0 : institutions - fii - government,
    government,
    public: at(NON_INSTITUTIONS) ?? 0,
  };
  return BUCKET_ORDER.map(key => ({key, pct: positive(pct[key])})).filter(
    b => b.pct > 0,
  );
};

/** What DII is made of at `index`: the named classes the company filed. */
export const diiConstituents = (
  ownership: FundamentalsOwnership,
  index: number,
): OwnershipConstituent[] => {
  const at = valueAt(ownership, index);
  return DII_CONSTITUENTS.map(c => ({...c, pct: at(c.code) ?? 0})).filter(
    c => c.pct > 0,
  );
};
