export interface OwnershipDeal {
  date: string;
  source: 'bulk' | 'block';
  name: string;
  deal_type: string;
  volume: number;
  price: number;
}

export interface OwnershipInsiderTrade {
  date: string | null;
  trader: string;
  trans_type: string;
  quantity: number | null;
  is_buy: boolean;
  holding_percent: number | null;
}

export interface OwnershipHolder {
  name: string;
  category: string;
  percentage: number;
  shares: number;
  pledge_pct: number | null;
}

export interface GetOwnershipResponse {
  deals: OwnershipDeal[];
  insider: OwnershipInsiderTrade[];
  top_holders: OwnershipHolder[];
  holders_as_of: string;
}
