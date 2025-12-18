export type Side = 'BID' | 'ASK';
export type OrderType = 'LIMIT' | 'MARKET';
export type Owner = 'NOISE' | 'AGENT';

export interface Order {
  id: string;
  price: number;
  volume: number;
  type: OrderType;
  side: Side;
  owner: Owner;
  timestamp: number;
}

export interface Trade {
  id: string;
  price: number;
  volume: number;
  timestamp: number;
  buyerOwner: Owner;
  sellerOwner: Owner;
}

export interface LobState {
  bids: Order[];
  asks: Order[];
  trades: Trade[];
  lastPrice: number;
}
