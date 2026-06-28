// context/ShotClockContext.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Single shot-clock timer shared across all three live-auction surfaces:
//   - auctioneer  (live/page)
//   - spectator   (watch/page)
//   - owner/team  (owner/page)
//
// Design:
//   • One interval lives here — not in each page.
//   • shotClock  : 0–100 percentage remaining.
//   • isLocked   : true once shotClock hits 0 AND a lot is active.
//   • Consumers call resetClock() on new bid / new lot.
//   • When isLocked, owner page disables bid button; auctioneer page shows
//     a "Bidding Locked — make a decision" prompt but keeps Sold/Unsold active.
//
// FIX (drift bug): previously the clock drained by a fixed amount per
// 100ms tick, reset to 100 whenever a realtime event arrived. That means
// the countdown's accuracy depended on exactly when each browser's
// websocket happened to deliver the event and how busy the tab was —
// not on when the bid/lot actually occurred in the database. Two tabs
// (e.g. auctioneer vs owner) could legitimately show different remaining
// time and therefore disagree about whether bidding is locked.
//
// Now resetClock() takes an optional anchorTime — the real DB timestamp
// (lot.startedAt or bid.placedAt) the countdown should be measured from.
// shotClock is computed every tick as elapsed-wall-clock-time-since-anchor,
// so every page that passes the same anchor converges on the same value
// regardless of network timing, animation delays, or tab throttling.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────────

interface ShotClockContextValue {
  /** 0–100 percentage of time remaining */
  shotClock:    number;
  /** true when shotClock has reached 0 and a lot is still open */
  isLocked:     boolean;
  /**
   * Call when a new lot starts or a new bid arrives — resets to 100.
   * Pass the real event timestamp (lot.startedAt / bid.placedAt) as
   * anchorTime so the countdown is measured from the actual event,
   * not from whenever this client happened to receive it. If omitted,
   * falls back to Date.now() (e.g. for purely local/optimistic resets).
   */
  resetClock:   (anchorTime?: string | number) => void;
  /** Call when a lot closes (sold/unsold) — freezes the clock at 0 */
  freezeClock:  () => void;
  /** Call when no lot is active — pauses draining */
  pauseClock:   () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const ShotClockContext = createContext<ShotClockContextValue | null>(null);

export function useShotClock(): ShotClockContextValue {
  const ctx = useContext(ShotClockContext);
  if (!ctx) throw new Error("useShotClock must be used inside <ShotClockProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

interface ShotClockProviderProps {
  children:     React.ReactNode;
  /** Seconds for a full drain.  Comes from session.timerSeconds. */
  timerSeconds: number;
}

type ClockMode = "running" | "paused" | "frozen";

export function ShotClockProvider({
  children,
  timerSeconds,
}: ShotClockProviderProps) {
  const [shotClock, setShotClock] = useState(100);
  const [isLocked,  setIsLocked]  = useState(false);
  const modeRef                   = useRef<ClockMode>("paused");
  const timerRef                  = useRef(timerSeconds);
  // FIX: the wall-clock moment the current countdown started from.
  // Every shotClock value is derived from (Date.now() - anchorRef.current),
  // so reloading the page or a slow tick doesn't change the answer.
  const anchorRef                 = useRef<number>(Date.now());

  // Keep timerRef in sync without restarting the interval
  useEffect(() => { timerRef.current = timerSeconds; }, [timerSeconds]);

  // Single interval — reads mode/anchor via refs so it never needs to be restarted
  useEffect(() => {
    const id = setInterval(() => {
      if (modeRef.current !== "running") return;

      const secs      = timerRef.current ?? 15;
      const elapsedMs = Date.now() - anchorRef.current;
      const pct       = Math.max(0, 100 - (elapsedMs / (secs * 1000)) * 100);

      setShotClock(pct);
      if (pct <= 0) setIsLocked(true);
    }, 100);

    return () => clearInterval(id);
  }, []); // intentionally stable — reads everything via refs

  // ── Public API ────────────────────────────────────────────────────────────

  const resetClock = useCallback((anchorTime?: string | number) => {
    // FIX: anchor to the real event time when the caller has one (lot
    // startedAt / bid placedAt). Falling back to Date.now() keeps this
    // backward-compatible for any caller that doesn't pass one.
    anchorRef.current = anchorTime ? new Date(anchorTime).getTime() : Date.now();
    modeRef.current   = "running";
    setShotClock(100);
    setIsLocked(false);
  }, []);

  const freezeClock = useCallback(() => {
    modeRef.current = "frozen";
    setShotClock(0);
    setIsLocked(false); // lot is closed — lock state no longer meaningful
  }, []);

  const pauseClock = useCallback(() => {
    modeRef.current = "paused";
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ShotClockContext.Provider
      value={{ shotClock, isLocked, resetClock, freezeClock, pauseClock }}
    >
      {children}
    </ShotClockContext.Provider>
  );
}