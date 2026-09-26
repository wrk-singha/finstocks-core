import type {Tier} from './schema.ts';

// The SEBI shareholding pattern, as a tree.
//
// The vendor's category codes are prefixed by role and the prefixes are easy
// to read backwards, so they were checked against filings rather than guessed:
//   F…    the promoter block   (Ftotalpromoter is the TOTAL, Indian + foreign)
//   IND…  Indian promoter      (INFY INDindivd 13.82 = the founders' stake)
//   IN…   public institutions  (FII, mutual funds, insurance, banks)
//   NIN…  public non-institutions (retail, HUF, trusts, bodies corporate)
// Verified on ADANIENT 202606: INDSubtotal 59.27 + FSubtotal 15.57 = 74.84 =
// Ftotalpromoter, and 74.84 + Totalpublic 25.16 = 100.
//
// The trap is INDindivd: it is promoter-family holding, not retail. Reading it
// as "public individual" reports Infosys's founders as 13.82% retail float.
// Public individuals are NINIndivd.

export interface OwnershipNode {
  code: string;
  label: string;
  tier: Tier;
  depth: 0 | 1 | 2;
  total?: boolean;
  hint?: string;
}

export const OWNERSHIP_TREE: readonly OwnershipNode[] = [
  {
    code: 'Ftotalpromoter',
    label: 'Promoter & promoter group',
    tier: 1,
    depth: 0,
    total: true,
    hint: 'The founding or controlling shareholders, Indian and foreign combined.',
  },
  {code: 'INDSubtotal', label: 'Indian promoters', tier: 2, depth: 1},
  {code: 'INDindivd', label: 'Individuals & HUF', tier: 2, depth: 2},
  {code: 'INDbodyCorp', label: 'Bodies corporate', tier: 2, depth: 2},
  {code: 'INDcgovt', label: 'Government', tier: 3, depth: 2},
  {
    code: 'INDFIBankcc',
    label: 'Financial institutions & banks',
    tier: 3,
    depth: 2,
  },
  {code: 'INDOther', label: 'Other Indian promoters', tier: 3, depth: 2},
  {
    code: 'INDAnyOtherSpecfd',
    label: 'Any other (specified)',
    tier: 3,
    depth: 2,
  },
  {code: 'FSubtotal', label: 'Foreign promoters', tier: 2, depth: 1},
  {code: 'FbodyCorp', label: 'Bodies corporate', tier: 3, depth: 2},
  {code: 'FInstitution', label: 'Institutions', tier: 3, depth: 2},
  {code: 'FNRIFN', label: 'NRIs & foreign nationals', tier: 3, depth: 2},
  {code: 'FOther', label: 'Other foreign promoters', tier: 3, depth: 2},
  {
    code: 'FAnyOtherSpecfd',
    label: 'Any other (specified)',
    tier: 3,
    depth: 2,
  },

  {
    code: 'Totalpublic',
    label: 'Public',
    tier: 1,
    depth: 0,
    total: true,
    hint: 'Everyone outside the promoter group — institutions and retail.',
  },
  {
    code: 'INSubtotal',
    label: 'Institutions',
    tier: 1,
    depth: 1,
    hint: 'Professional money: mutual funds, foreign investors, insurers, banks.',
  },
  {code: 'INMFUTI', label: 'Mutual funds & UTI', tier: 1, depth: 2},
  {
    code: 'INFII',
    label: 'Foreign institutional investors',
    tier: 1,
    depth: 2,
  },
  {
    code: 'INForeignPortInv',
    label: 'Foreign portfolio investors',
    tier: 1,
    depth: 2,
  },
  {code: 'INInsurance', label: 'Insurance companies', tier: 2, depth: 2},
  {
    code: 'INFIBanks',
    label: 'Banks & financial institutions',
    tier: 2,
    depth: 2,
  },
  {
    code: 'INAltInvFund',
    label: 'Alternative investment funds',
    tier: 2,
    depth: 2,
  },
  {
    code: 'INProviPenFund',
    label: 'Provident & pension funds',
    tier: 2,
    depth: 2,
  },
  {code: 'INcgovt', label: 'Government', tier: 3, depth: 2},
  {code: 'INVenCap', label: 'Venture capital funds', tier: 3, depth: 2},
  {code: 'INForVenCap', label: 'Foreign venture capital', tier: 3, depth: 2},
  {code: 'INForBody', label: 'Foreign bodies corporate', tier: 3, depth: 2},
  {
    code: 'INForFinIns',
    label: 'Foreign financial institutions',
    tier: 3,
    depth: 2,
  },
  {
    code: 'INStateFinCorp',
    label: 'State financial corporations',
    tier: 3,
    depth: 2,
  },
  {code: 'INOther', label: 'Other institutions', tier: 3, depth: 2},
  {
    code: 'INAnyOtherSpecfd',
    label: 'Any other (specified)',
    tier: 3,
    depth: 2,
  },

  {
    code: 'NINSubtotal',
    label: 'Non-institutions',
    tier: 1,
    depth: 1,
    hint: 'Retail and other non-professional holders.',
  },
  {code: 'NINIndivd', label: 'Individuals', tier: 1, depth: 2},
  {
    code: 'NINIndivd1lac',
    label: 'Individuals holding up to ₹1 lakh',
    tier: 2,
    depth: 2,
  },
  {
    code: 'NINIndivd1lacmore',
    label: 'Individuals holding over ₹1 lakh',
    tier: 2,
    depth: 2,
  },
  {code: 'NINbodyCorp', label: 'Bodies corporate', tier: 2, depth: 2},
  {code: 'NINNRI', label: 'Non-resident Indians', tier: 2, depth: 2},
  {code: 'NINHUF', label: 'Hindu undivided families', tier: 3, depth: 2},
  {code: 'NINTrusts', label: 'Trusts', tier: 3, depth: 2},
  {code: 'NINClearMemb', label: 'Clearing members', tier: 3, depth: 2},
  {code: 'NINDirector', label: 'Directors & relatives', tier: 3, depth: 2},
  {code: 'NINEmployees', label: 'Employees', tier: 3, depth: 2},
  {
    code: 'NINIndEmpTrust',
    label: 'Employee benefit trust',
    tier: 3,
    depth: 2,
  },
  {code: 'NINFornColl', label: 'Foreign collaborators', tier: 3, depth: 2},
  {
    code: 'NINFornCorpBody',
    label: 'Foreign bodies corporate',
    tier: 3,
    depth: 2,
  },
  {code: 'NINFornMF', label: 'Foreign mutual funds', tier: 3, depth: 2},
  {code: 'NINMktMaker', label: 'Market makers', tier: 3, depth: 2},
  {code: 'NINSociety', label: 'Societies', tier: 3, depth: 2},
  {code: 'NINEscrow', label: 'Escrow accounts', tier: 3, depth: 2},
  {code: 'NINShareIntransit', label: 'Shares in transit', tier: 3, depth: 2},
  {
    code: 'NINIndivdNBFC',
    label: 'NBFCs registered with RBI',
    tier: 3,
    depth: 2,
  },
  {code: 'NINother', label: 'Other non-institutions', tier: 3, depth: 2},
  {
    code: 'NINAnyOtherSpecfd',
    label: 'Any other (specified)',
    tier: 3,
    depth: 2,
  },

  {
    code: 'CustodianDRs',
    label: 'Custodian for depository receipts',
    tier: 2,
    depth: 0,
  },
  {code: 'ADR', label: 'American depository receipts', tier: 3, depth: 1},
  {code: 'GDR', label: 'Global depository receipts', tier: 3, depth: 1},
  {code: 'OtherEWF', label: 'Employee welfare fund', tier: 3, depth: 0},
  {code: 'OtherPromgroup', label: 'Other promoter group', tier: 3, depth: 0},
  {code: 'OtherPrtFirms', label: 'Partnership firms', tier: 3, depth: 0},
  {
    code: 'SASF',
    label: 'Stressed assets stabilisation fund',
    tier: 3,
    depth: 0,
  },
  {code: 'Other', label: 'Other', tier: 3, depth: 0},
  {code: 'Totalprompublic', label: 'Promoter and public', tier: 3, depth: 0},
  {code: 'GrandTotal', label: 'Total', tier: 2, depth: 0, total: true},
];

export const OWNERSHIP_BY_CODE: ReadonlyMap<string, OwnershipNode> = new Map(
  OWNERSHIP_TREE.map(n => [n.code, n]),
);

// The headline split a first-time reader needs, in the order a doughnut or a
// stacked bar should lay them out.
export const OWNERSHIP_HEADLINE: readonly {code: string; label: string}[] = [
  {code: 'Ftotalpromoter', label: 'Promoter'},
  {code: 'INFII', label: 'FII'},
  {code: 'INForeignPortInv', label: 'FPI'},
  {code: 'INMFUTI', label: 'Mutual funds'},
  {code: 'INInsurance', label: 'Insurance'},
  {code: 'INFIBanks', label: 'Banks & FIs'},
  {code: 'NINIndivd', label: 'Retail'},
  {code: 'NINbodyCorp', label: 'Corporate bodies'},
];
