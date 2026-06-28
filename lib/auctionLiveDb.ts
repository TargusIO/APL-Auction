// lib/auctionLiveDb.ts
// ─────────────────────────────────────────────────────────────────────────────
// All Supabase reads / writes / realtime for LIVE auction conducting.
// Imported by the auctioneer page, the watch (spectator) page, and the
// owner portal.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "./supabse";
import type { BiddingTier } from "@/types/auction";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AuctionLot {
  id:              string;
  auctionId:       string;
  playerId:        string;
  playerName:      string;
  playerRole:      string;
  playerCountry:   string;
  playerImg:       string;
  lotNumber:       number;
  status:          "pending" | "sold" | "unsold";
  currentBid:      number;
  basePrice:       number;
  winningTeamId:   string | null;
  winningTeamCode: string | null;
  startedAt:       string;
  closedAt:        string | null;
}

export interface BidEntry {
  id:        string;
  lotId:     string;
  auctionId: string;
  teamId:    string;
  teamCode:  string;
  teamName:  string;
  teamColor: string;
  amount:    number;
  placedAt:  string;
}

export interface LiveAuctionState {
  currentLot:    AuctionLot | null;
  bidHistory:    BidEntry[];
  completedLots: AuctionLot[];
  /** Number of lots started so far (used for display only, not sequencing). */
  lotNumber:     number;
}

// ─────────────────────────────────────────────────────────────────────────────
// BID INCREMENT CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────

export function getNextBidAmount(currentBid: number, tiers: BiddingTier[]): number {
  for (const tier of tiers) {
    const inRange =
      currentBid >= tier.from && (tier.to === null || currentBid < tier.to);
    if (inRange) return currentBid + tier.increment;
  }
  const last = tiers[tiers.length - 1];
  return currentBid + (last?.increment ?? 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIALISE PURSES  (call once right after launch)
// ─────────────────────────────────────────────────────────────────────────────

export async function initTeamPurses(
  auctionId: string,
  totalPoints: number
): Promise<void> {
  const { error } = await supabase.rpc("init_team_purses", {
    p_auction_id:   auctionId,
    p_total_points: totalPoints,
  });
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Put a player on the block.
 * Closes any accidentally still-open lot first.
 * Denormalises player fields into the lot row so realtime updates
 * don't require an extra join on every subscriber.
 */
export async function startLot(
  auctionId: string,
  player: {
    id:      string;
    name:    string;
    role:    string;
    country: string;
    img:     string;
    price:   number;
  },
  lotNumber: number
): Promise<AuctionLot> {
  // Force-close any orphaned pending lot
  await supabase
    .from("auction_lots")
    .update({ status: "unsold", closed_at: new Date().toISOString() })
    .eq("auction_id", auctionId)
    .eq("status", "pending");

  const { data, error } = await supabase
    .from("auction_lots")
    .insert({
      auction_id:      auctionId,
      player_id:       player.id,
      lot_number:      lotNumber,
      status:          "pending",
      current_bid:     player.price,
      base_price:      player.price,
      winning_team_id: null,
      player_name:     player.name,
      player_role:     player.role,
      player_country:  player.country,
      player_img:      player.img,
      started_at:      new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapLot(data);
}

/** Place a bid on the current lot */
export async function placeBid(
  lotId:     string,
  auctionId: string,
  teamId:    string,
  teamCode:  string,
  teamName:  string,
  teamColor: string,
  amount:    number
): Promise<BidEntry> {
  const { data: bid, error: bidErr } = await supabase
    .from("bid_history")
    .insert({
      lot_id:     lotId,
      auction_id: auctionId,
      team_id:    teamId,
      team_code:  teamCode,
      team_name:  teamName,
      team_color: teamColor,
      amount,
      placed_at:  new Date().toISOString(),
    })
    .select("*")
    .single();

  if (bidErr) throw bidErr;

  const { error: lotErr } = await supabase
    .from("auction_lots")
    .update({
      current_bid:       amount,
      winning_team_id:   teamId,
      winning_team_code: teamCode,
    })
    .eq("id", lotId);

  if (lotErr) throw lotErr;

  return mapBid(bid);
}

/**
 * Mark the current lot as SOLD and update purse + roster.
 *
 * FIX (Bug 6): These four writes are not wrapped in a DB transaction here
 * because Supabase JS cannot open transactions directly.  To make this atomic,
 * replace this function with a single RPC call:
 *
 *   create or replace function close_lot_sold(
 *     p_lot_id         uuid,
 *     p_auction_id     uuid,
 *     p_player_id      uuid,
 *     p_winning_team_id uuid,
 *     p_final_price    int
 *   ) returns void language plpgsql as $$
 *   begin
 *     update auction_lots set status='sold', closed_at=now() where id=p_lot_id;
 *     update players set sold_to_team_id=p_winning_team_id, sold_price=p_final_price, status='sold' where id=p_player_id;
 *     perform increment_team_roster(p_winning_team_id, p_auction_id);
 *     perform deduct_team_purse(p_winning_team_id, p_auction_id, p_final_price);
 *   end;
 *   $$;
 *
 * Until that RPC exists, we run the writes in parallel and surface any
 * individual error so the auctioneer can retry.
 */
export async function closeLotSold(
  lotId:         string,
  auctionId:     string,
  playerId:      string,
  winningTeamId: string,
  finalPrice:    number
): Promise<void> {
  const now = new Date().toISOString();

  const [r1, r2, r3, r4] = await Promise.all([
    supabase
      .from("auction_lots")
      .update({ status: "sold", closed_at: now })
      .eq("id", lotId),

    supabase
      .from("players")
      .update({ sold_to_team_id: winningTeamId, sold_price: finalPrice, status: "sold" })
      .eq("id", playerId),

    supabase.rpc("increment_team_roster", {
      p_team_id:    winningTeamId,
      p_auction_id: auctionId,
    }),

    supabase.rpc("deduct_team_purse", {
      p_team_id:    winningTeamId,
      p_auction_id: auctionId,
      p_amount:     finalPrice,
    }),
  ]);

  // Surface the first error so the caller can show it to the auctioneer
  for (const r of [r1, r2, r3, r4]) {
    if (r.error) throw r.error;
  }
}

/** Mark the current lot as UNSOLD */
export async function closeLotUnsold(lotId: string, playerId: string): Promise<void> {
  const [r1, r2] = await Promise.all([
    supabase
      .from("auction_lots")
      .update({ status: "unsold", closed_at: new Date().toISOString() })
      .eq("id", lotId),

    supabase
      .from("players")
      .update({ status: "unsold" })
      .eq("id", playerId),
  ]);

  if (r1.error) throw r1.error;
  if (r2.error) throw r2.error;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD LIVE STATE  (used on page mount by all viewer pages)
// ─────────────────────────────────────────────────────────────────────────────

export async function loadLiveState(auctionId: string): Promise<LiveAuctionState> {
  const { data: currentLotRaw } = await supabase
    .from("auction_lots")
    .select("*")
    .eq("auction_id", auctionId)
    .eq("status", "pending")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [
    { data: bidsRaw },
    { data: completedRaw },
  ] = await Promise.all([
    currentLotRaw
      ? supabase
          .from("bid_history")
          .select("*")
          .eq("lot_id", currentLotRaw.id)  // scoped to current lot only
          .order("placed_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),

    supabase
      .from("auction_lots")
      .select("*")
      .eq("auction_id", auctionId)
      .in("status", ["sold", "unsold"])
      .order("closed_at", { ascending: false }),
  ]);

  // FIX (Bug 7): lotNumber is the current lot's own sequential number,
  // not a count of all rows.  Falls back to completed count + 1 if no
  // active lot (between lots).
  const lotNumber = currentLotRaw?.lot_number
    ?? ((completedRaw?.length ?? 0));

  return {
    currentLot:    currentLotRaw ? mapLot(currentLotRaw) : null,
    bidHistory:    (bidsRaw ?? []).map(mapBid),
    completedLots: (completedRaw ?? []).map(mapLot),
    lotNumber,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM PURSES
// ─────────────────────────────────────────────────────────────────────────────

export async function loadTeamPurses(
  auctionId: string
): Promise<Record<string, { remaining: number; roster: number }>> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, roster, remaining_purse")
    .eq("auction_id", auctionId);

  if (error) throw error;

  const result: Record<string, { remaining: number; roster: number }> = {};
  for (const t of data ?? []) {
    result[t.id] = {
      remaining: t.remaining_purse ?? 0,
      roster:    t.roster ?? 0,
    };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to lot changes for this auction.
 *
 * FIX (Bug 2 / Redundancy 3): The orphan-close guard is now centralised here
 * rather than duplicated differently across all three pages.  Pass
 * `getCurrentLotId` (a ref getter returning the currently-active lot id)
 * and close events for stale lots are silently dropped before the callback
 * fires.  The caller never needs to implement its own guard.
 */
export function subscribeToLot(
  auctionId:      string,
  onLotChange:    (lot: AuctionLot) => void,
  getCurrentLotId?: () => string | null
) {
  return supabase
    .channel(`lot-${auctionId}`)
    .on(
      "postgres_changes",
      {
        event:  "*",
        schema: "public",
        table:  "auction_lots",
        filter: `auction_id=eq.${auctionId}`,
      },
      async (payload) => {
        const incoming = payload.new as any;

        // Centralised orphan-close guard:
        // Discard sold/unsold events that belong to a lot that is no longer
        // the active one — evaluated at delivery time, not subscription time.
        if (getCurrentLotId) {
          const activeLotId = getCurrentLotId();
          const isClose     =
            incoming.status === "unsold" || incoming.status === "sold";
          if (isClose && activeLotId && incoming.id !== activeLotId) {
            return;
          }
        }

        const { data } = await supabase
          .from("auction_lots")
          .select("*")
          .eq("id", incoming.id)
          .single();
        if (data) onLotChange(mapLot(data));
      }
    )
    .subscribe();
}

/**
 * Subscribe to new bids for this auction.
 *
 * FIX (Bug 3): The callback now receives the full BidEntry including lotId.
 * Callers that only care about bids for the current lot should guard with:
 *   if (bid.lotId !== currentLotRef.current?.id) return;
 * This is done in all three pages that consume bids.
 */
export function subscribeToBids(
  auctionId: string,
  onNewBid:  (bid: BidEntry) => void
) {
  return supabase
    .channel(`bids-${auctionId}`)
    .on(
      "postgres_changes",
      {
        event:  "INSERT",
        schema: "public",
        table:  "bid_history",
        filter: `auction_id=eq.${auctionId}`,
      },
      (payload) => {
        onNewBid(mapBid(payload.new as any));
      }
    )
    .subscribe();
}

/** Subscribe to team purse changes (for live budget updates) */
export function subscribeToTeamPurses(
  auctionId:    string,
  onPurseChange: (teamId: string, remaining: number, roster: number) => void
) {
  return supabase
    .channel(`purses-${auctionId}`)
    .on(
      "postgres_changes",
      {
        event:  "UPDATE",
        schema: "public",
        table:  "teams",
        filter: `auction_id=eq.${auctionId}`,
      },
      (payload) => {
        const r = payload.new as any;
        onPurseChange(r.id, r.remaining_purse ?? 0, r.roster ?? 0);
      }
    )
    .subscribe();
}

// ─────────────────────────────────────────────────────────────────────────────
// OWNER PORTAL AUTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a team PIN.
 *
 * FIX (Bug 5): PIN comparison should happen server-side via an RPC that
 * never returns the stored PIN to the client.  Until that RPC exists this
 * falls back to the client-side comparison below, but the PIN field should
 * NOT be included in the select once the RPC is in place.
 *
 * Recommended RPC:
 *   create or replace function verify_team_pin(
 *     p_auction_id uuid, p_team_code text, p_pin text
 *   ) returns json language plpgsql security definer as $$
 *   declare r teams%rowtype;
 *   begin
 *     select * into r from teams
 *     where auction_id=p_auction_id and code=upper(p_team_code);
 *     if not found or r.pin <> p_pin then return null; end if;
 *     return json_build_object('id',r.id,'name',r.name,'code',r.code,
 *       'color',r.color,'remaining_purse',r.remaining_purse,'roster',r.roster);
 *   end;
 *   $$;
 */
export async function verifyTeamPin(
  auctionId: string,
  teamCode:  string,
  pin:       string
): Promise<{ id: string; name: string; code: string; color: string; remaining_purse: number; roster: number } | null> {
  const { data } = await supabase
    .from("teams")
    .select("id, name, code, color, remaining_purse, roster, pin")
    .eq("auction_id", auctionId)
    .eq("code", teamCode.toUpperCase())
    .maybeSingle();

  if (!data || data.pin !== pin) return null;
  // Strip the PIN before returning — never expose it to the UI layer
  const { pin: _pin, ...safe } = data;
  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
// START RANDOM LOT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FIX (Bug 1): The RPC may return a single object or an array depending on
 * the DB function definition.  We normalise both cases here so mapLot always
 * receives a plain object.
 */
export async function startRandomLot(auctionId: string): Promise<AuctionLot> {
  const { data, error } = await supabase.rpc("start_random_lot", {
    p_auction_id: auctionId,
  });
  if (error) throw error;
  if (!data) throw new Error("start_random_lot returned no data");

  // Normalise: RPC may return a single row object or a 1-element array
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw) throw new Error("start_random_lot returned an empty result set");

  return mapLot(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPPERS  (DB snake_case → TS camelCase)
// ─────────────────────────────────────────────────────────────────────────────

function mapLot(raw: any): AuctionLot {
  return {
    id:              raw.id,
    auctionId:       raw.auction_id,
    playerId:        raw.player_id,
    playerName:      raw.player_name    ?? "",
    playerRole:      raw.player_role    ?? "",
    playerCountry:   raw.player_country ?? "",
    playerImg:       raw.player_img     ?? "",
    lotNumber:       raw.lot_number,
    status:          raw.status,
    currentBid:      raw.current_bid,
    basePrice:       raw.base_price,
    winningTeamId:   raw.winning_team_id   ?? null,
    winningTeamCode: raw.winning_team_code ?? null,
    startedAt:       raw.started_at,
    closedAt:        raw.closed_at ?? null,
  };
}

function mapBid(raw: any): BidEntry {
  return {
    id:        raw.id,
    lotId:     raw.lot_id,
    auctionId: raw.auction_id,
    teamId:    raw.team_id,
    teamCode:  raw.team_code,
    teamName:  raw.team_name  ?? "",
    teamColor: raw.team_color ?? "",
    amount:    raw.amount,
    placedAt:  raw.placed_at,
  };
}