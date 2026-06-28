// In @/types/sankeytype
export interface Player {
  id: number;
  supabaseId?: string;
  name: string;
  role: string;
  origin: string;
  price: number; // Add this if it's missing
  capped: boolean;
  img: string;
  country: string;
  status?: 'locked' | 'sold' | 'pending' | 'unsold'; // Add this if it's missing
  lotOrder?: number | null;
  teamShortCode?: string | null; // Add this if it's missing
}
export type Team = {
  id: string;
  shortCode: string;
  name: string;
  purse: string;
  logoUrl: string | null;
};

export type AuctionConfig = {
  players: Player[];
  teams: Team[];
};
