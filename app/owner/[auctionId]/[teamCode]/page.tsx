"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabse";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface TeamRow {
  id:              string;
  name:            string;
  code:            string;
  color:           string;
  logo:            string | null;
  remaining_purse: number;
  roster:          number;
}

interface AuctionRow {
  id:     string;
  name:   string;
  status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Geist+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .ms {
    font-family: 'Material Symbols Outlined';
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    font-style: normal; line-height: 1;
    display: inline-block; user-select: none;
  }
  .ms-fill { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }

  @keyframes floatUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseOrb {
    0%,100% { opacity: 0.5; transform: scale(1); }
    50%     { opacity: 0.85; transform: scale(1.06); }
  }
  @keyframes blink {
    0%,100% { opacity: 1; }
    50%     { opacity: 0.25; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes shimmerBar {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }

  .nav-card {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(16,20,21,0.65);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 18px 20px;
    cursor: pointer;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
    -webkit-tap-highlight-color: transparent;
    position: relative;
    overflow: hidden;
  }
  .nav-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 60%);
    pointer-events: none;
  }
  .nav-card:active {
    transform: scale(0.97);
  }

  .enter-btn {
    width: 100%;
    padding: 18px;
    border-radius: 14px;
    border: none;
    font-family: 'Archivo Narrow', sans-serif;
    font-size: 20px;
    font-weight: 700;
    font-style: italic;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .enter-btn:active { transform: scale(0.97); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function OwnerIndexPage({
  params,
}: {
  params: Promise<{ auctionId: string; teamCode: string }>;
}) {
  const { auctionId, teamCode } = use(params);
  const router = useRouter();

  const [auction, setAuction] = useState<AuctionRow | null>(null);
  const [team,    setTeam]    = useState<TeamRow | null>(null);
  const [rules,   setRules]   = useState<{ team_size: number; total_points: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const base = `/owner/${auctionId}/${teamCode}`;

  useEffect(() => {
    async function load() {
      const [{ data: auc }, { data: tm }, { data: r }] = await Promise.all([
        supabase.from("auctions").select("id, name, status").eq("id", auctionId).single(),
        supabase
          .from("teams")
          .select("id, name, code, color, logo, remaining_purse, roster")
          .eq("auction_id", auctionId)
          .ilike("code", teamCode)
          .single(),
        supabase
          .from("rules")
          .select("team_size, total_points")
          .eq("auction_id", auctionId)
          .maybeSingle(),
      ]);
      if (auc) setAuction(auc);
      if (tm)  setTeam(tm);
      if (r)   setRules(r);
      setLoading(false);
    }
    load().catch(console.error);
  }, [auctionId, teamCode]);

  if (loading) {
    return (
      <>
        <style>{STYLES}</style>
        <div style={{
          background: "#0b0f10", height: "100dvh",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 14,
        }}>
          <div style={{
            width: 36, height: 36,
            border: "2px solid rgba(228,93,53,0.15)",
            borderTop: "2px solid #e45d35",
            borderRadius: "50%",
            animation: "spin 0.9s linear infinite",
          }} />
          <p style={{
            fontFamily: "'Geist Mono'", fontSize: 10,
            color: "#3a4a54", textTransform: "uppercase", letterSpacing: "0.2em",
          }}>Loading…</p>
        </div>
      </>
    );
  }

  const accent      = team?.color || "#e45d35";
  const purse       = team?.remaining_purse ?? 0;
  const roster      = team?.roster ?? 0;
  const totalSlots  = rules?.team_size ?? 16;
  const totalPoints = rules?.total_points ?? 50000;
  const rosterPct   = totalSlots > 0 ? (roster / totalSlots) * 100 : 0;
  const pursePct    = totalPoints > 0 ? (purse / totalPoints) * 100 : 0;

  const NAV_ITEMS = [
    {
      segment: "bid",
      icon:    "gavel",
      label:   "Bid Room",
      sub:     "Place bids live",
      primary: true,
    },
    {
      segment: "squad",
      icon:    "groups",
      label:   "Squad",
      sub:     `${roster} of ${totalSlots} players signed`,
      primary: false,
    },
    {
      segment: "budget",
      icon:    "payments",
      label:   "Budget",
      sub:     `${purse.toLocaleString()} CR remaining`,
      primary: false,
    },
    {
      segment: "history",
      icon:    "reorder",
      label:   "Bid History",
      sub:     "Every transaction",
      primary: false,
    },
  ];

  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        background: "#0b0f10",
        color: "#e0e3e4",
        minHeight: "100dvh",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}>

        {/* ambient glow */}
        <div style={{
          position: "fixed", top: -100, left: -100,
          width: 360, height: 360, borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`,
          filter: "blur(60px)", pointerEvents: "none",
          animation: "pulseOrb 6s ease-in-out infinite",
        }} />

        {/* ── HEADER ── */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(11,15,16,0.85)",
          backdropFilter: "blur(20px)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 7,
              background: "#e45d35",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span className="ms ms-fill" style={{ fontSize: 17, color: "#0b0f10" }}>sports_cricket</span>
            </div>
            <div>
              <div style={{
                fontFamily: "'Archivo Narrow'", fontSize: 15, fontWeight: 700,
                color: "#e8ecf0", textTransform: "uppercase", letterSpacing: "-0.2px",
              }}>
                {auction?.name ?? "APL Auction"}
              </div>
              <div style={{
                fontFamily: "'Geist Mono'", fontSize: 8,
                color: "#3a4a54", letterSpacing: "0.15em", textTransform: "uppercase",
              }}>
                Owner Portal
              </div>
            </div>
          </div>

          {auction?.status === "live" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(127,29,29,0.3)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 99, padding: "4px 10px",
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#ef4444",
                animation: "blink 1s ease-in-out infinite",
              }} />
              <span style={{
                fontFamily: "'Geist Mono'", fontSize: 8,
                color: "#f87171", fontWeight: 700,
                letterSpacing: "0.18em", textTransform: "uppercase",
              }}>Live</span>
            </div>
          )}
        </header>

        {/* ── BODY ── */}
        <main style={{
          flex: 1, overflowY: "auto",
          padding: "22px 18px 40px",
          display: "flex", flexDirection: "column", gap: 20,
        }}>

          {/* ── TEAM HERO ── */}
          <div style={{
            animation: "floatUp 0.45s ease both",
            background: `${accent}0d`,
            border: `1px solid ${accent}30`,
            borderRadius: 20,
            padding: "22px 20px 20px",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* big faint code watermark */}
            <div style={{
              position: "absolute", right: -10, top: -10,
              fontFamily: "'Archivo Narrow'", fontSize: 80,
              fontWeight: 800, fontStyle: "italic",
              color: `${accent}08`, textTransform: "uppercase",
              pointerEvents: "none", lineHeight: 1, userSelect: "none",
            }}>
              {team?.code}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              {/* logo */}
              <div style={{
                width: 60, height: 60, borderRadius: 14, flexShrink: 0,
                background: `${accent}15`,
                border: `1px solid ${accent}35`,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                boxShadow: `0 0 28px ${accent}25`,
              }}>
                {team?.logo ? (
                  <img src={team.logo} alt={team.name}
                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                ) : (
                  <span style={{
                    fontFamily: "'Archivo Narrow'", fontSize: 18,
                    fontWeight: 800, color: accent,
                    textTransform: "uppercase",
                  }}>{team?.code.slice(0, 3)}</span>
                )}
              </div>

              <div>
                <p style={{
                  fontFamily: "'Geist Mono'", fontSize: 9,
                  color: accent, letterSpacing: "0.2em",
                  textTransform: "uppercase", marginBottom: 4,
                }}>Your Franchise</p>
                <h1 style={{
                  fontFamily: "'Archivo Narrow'", fontSize: 26,
                  fontWeight: 700, fontStyle: "italic",
                  color: "#e8ecf0", textTransform: "uppercase",
                  letterSpacing: "-0.3px", lineHeight: 1,
                }}>{team?.name ?? teamCode.toUpperCase()}</h1>
              </div>
            </div>

            {/* stat row */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}>
              {/* purse */}
              <div style={{
                background: "rgba(11,15,16,0.5)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: "12px 14px",
              }}>
                <p style={{
                  fontFamily: "'Geist Mono'", fontSize: 8,
                  color: "#4a5a64", letterSpacing: "0.15em",
                  textTransform: "uppercase", marginBottom: 6,
                }}>Purse Left</p>
                <p style={{
                  fontFamily: "'Archivo Narrow'", fontSize: 24,
                  fontWeight: 700, color: "#e8ecf0", lineHeight: 1,
                }}>
                  {purse >= 1000
                    ? `${(purse / 1000).toFixed(purse % 1000 === 0 ? 0 : 1)}K`
                    : purse.toLocaleString()}
                  <span style={{ fontSize: 11, color: "#4a5a64", marginLeft: 3 }}>CR</span>
                </p>
                <div style={{
                  marginTop: 8, height: 3, borderRadius: 99,
                  background: "rgba(255,255,255,0.06)", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    width: `${pursePct}%`,
                    background: pursePct < 25 ? "#ef4444" : accent,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>

              {/* squad */}
              <div style={{
                background: "rgba(11,15,16,0.5)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: "12px 14px",
              }}>
                <p style={{
                  fontFamily: "'Geist Mono'", fontSize: 8,
                  color: "#4a5a64", letterSpacing: "0.15em",
                  textTransform: "uppercase", marginBottom: 6,
                }}>Squad</p>
                <p style={{
                  fontFamily: "'Archivo Narrow'", fontSize: 24,
                  fontWeight: 700, color: "#e8ecf0", lineHeight: 1,
                }}>
                  {roster}
                  <span style={{ fontSize: 14, color: "#4a5a64" }}>/{totalSlots}</span>
                </p>
                <div style={{
                  marginTop: 8, height: 3, borderRadius: 99,
                  background: "rgba(255,255,255,0.06)", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    width: `${rosterPct}%`,
                    background: accent,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── ENTER BID ROOM CTA ── */}
          <div style={{ animation: "floatUp 0.45s 0.08s ease both" }}>
            <button
              className="enter-btn"
              onClick={() => router.push(`${base}/bid`)}
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
                color: "#0b0f10",
                boxShadow: `0 8px 32px ${accent}45`,
              }}
            >
              <span className="ms ms-fill" style={{ fontSize: 22 }}>gavel</span>
              Enter Bid Room
            </button>
          </div>

          {/* ── NAV CARDS ── */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 9,
            animation: "floatUp 0.45s 0.14s ease both",
          }}>
            <p style={{
              fontFamily: "'Geist Mono'", fontSize: 9,
              color: "#3a4a54", letterSpacing: "0.18em",
              textTransform: "uppercase", marginBottom: 4,
            }}>Quick Access</p>

            {NAV_ITEMS.filter(n => !n.primary).map((item) => (
              <a
                key={item.segment}
                href={`${base}/${item.segment}`}
                className="nav-card"
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                  background: `${accent}12`,
                  border: `1px solid ${accent}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span className="ms ms-fill" style={{ fontSize: 20, color: accent }}>
                    {item.icon}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Archivo Narrow'", fontSize: 17,
                    fontWeight: 700, color: "#e8ecf0",
                    textTransform: "uppercase", letterSpacing: "-0.2px",
                  }}>{item.label}</div>
                  <div style={{
                    fontFamily: "'Geist Mono'", fontSize: 9,
                    color: "#5a6a74", marginTop: 2, letterSpacing: "0.05em",
                  }}>{item.sub}</div>
                </div>
                <span className="ms" style={{ color: "#2a3a44", fontSize: 18, flexShrink: 0 }}>
                  chevron_right
                </span>
              </a>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}