"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabse";
import {
  subscribeToTeamPurses,
} from "@/lib/auctionLiveDb";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface OwnerTeam {
  id:              string;
  name:            string;
  code:            string;
  color:           string;
  logo:            string | null;
  remainingPurse:  number;
  roster:          number;
}

export interface OwnerAuction {
  id:     string;
  name:   string;
  status: "setup" | "live" | "paused" | "completed";
}

export interface OwnerRules {
  teamSize:    number;
  totalPoints: number;
  timerSeconds: number;
  tiers: { from: number; to: number | null; increment: number }[];
}

interface OwnerContextValue {
  auction:    OwnerAuction | null;
  team:       OwnerTeam | null;
  rules:      OwnerRules | null;
  loading:    boolean;
  isLive:     boolean;
  isPaused:   boolean;
  isEnded:    boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
const OwnerContext = createContext<OwnerContextValue | null>(null);

export function useOwner(): OwnerContextValue {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used inside <OwnerProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────
export function OwnerProvider({
  children,
  auctionId,
  teamCode,
}: {
  children:  React.ReactNode;
  auctionId: string;
  teamCode:  string;
}) {
  const [auction, setAuction] = useState<OwnerAuction | null>(null);
  const [team,    setTeam]    = useState<OwnerTeam | null>(null);
  const [rules,   setRules]   = useState<OwnerRules | null>(null);
  const [loading, setLoading] = useState(true);

  const teamIdRef = useRef<string | null>(null);

  // ── initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [{ data: auc }, { data: tm }, { data: r }, { data: sc }] =
        await Promise.all([
          supabase
            .from("auctions")
            .select("id, name, status")
            .eq("id", auctionId)
            .single(),
          supabase
            .from("teams")
            .select("id, name, code, color, logo, remaining_purse, roster")
            .eq("auction_id", auctionId)
            .ilike("code", teamCode)
            .single(),
          supabase
            .from("rules")
            .select("team_size, total_points, tiers")
            .eq("auction_id", auctionId)
            .maybeSingle(),
          supabase
            .from("session_config")
            .select("timer_seconds")
            .eq("auction_id", auctionId)
            .maybeSingle(),
        ]);

      if (auc) {
        setAuction({
          id:     auc.id,
          name:   auc.name,
          status: auc.status,
        });
      }

      if (tm) {
        teamIdRef.current = tm.id;
        setTeam({
          id:             tm.id,
          name:           tm.name,
          code:           tm.code,
          color:          tm.color,
          logo:           tm.logo ?? null,
          remainingPurse: tm.remaining_purse ?? 0,
          roster:         tm.roster ?? 0,
        });
      }

      if (r) {
        setRules({
          teamSize:    r.team_size    ?? 16,
          totalPoints: r.total_points ?? 50000,
          timerSeconds: sc?.timer_seconds ?? 15,
          tiers:       r.tiers ?? [],
        });
      }

      setLoading(false);
    }

    load().catch(console.error);
  }, [auctionId, teamCode]);

  // ── realtime: auction status ───────────────────────────────────────────────
  useEffect(() => {
    const sub = supabase
      .channel(`owner-auction-${auctionId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "auctions",
          filter: `id=eq.${auctionId}`,
        },
        (payload) => {
          setAuction((prev) =>
            prev ? { ...prev, status: payload.new.status } : prev
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [auctionId]);

  // ── realtime: purse / roster ───────────────────────────────────────────────
  useEffect(() => {
    if (!auctionId) return;

    const sub = subscribeToTeamPurses(auctionId, (teamId, remaining, roster) => {
      if (teamId === teamIdRef.current) {
        setTeam((prev) =>
          prev ? { ...prev, remainingPurse: remaining, roster } : prev
        );
      }
    });

    return () => { supabase.removeChannel(sub); };
  }, [auctionId]);

  const isLive   = auction?.status === "live";
  const isPaused = auction?.status === "paused";
  const isEnded  = auction?.status === "completed";

  return (
    <OwnerContext.Provider value={{ auction, team, rules, loading, isLive, isPaused, isEnded }}>
      {children}
    </OwnerContext.Provider>
  );
}