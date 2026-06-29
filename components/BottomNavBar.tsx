"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

const NAV_ITEMS = [
  { segment: "bid",     icon: "gavel",    label: "Auction" },
  { segment: "squad",   icon: "groups",   label: "Squad"   },
  { segment: "budget",  icon: "payments", label: "Budget"  },
  { segment: "history", icon: "reorder",  label: "History" },
];

const NAV_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');
  .nav-ms {
    font-family: 'Material Symbols Outlined';
    font-style: normal;
    line-height: 1;
    display: inline-block;
    user-select: none;
    font-size: 24px;
  }
`;

export default function BottomNavBar() {
  const pathname = usePathname();
  const params   = useParams();

  const auctionId = (params?.auctionId as string) ?? "";
  const teamCode  = (params?.teamCode  as string) ?? "";

  if (!auctionId || !teamCode) return null;

  const base = `/owner/${auctionId}/${teamCode}`;

  return (
    <>
      <style>{NAV_STYLES}</style>
      <nav
        style={{
          position:        "fixed",
          bottom:          0,
          left:            0,
          right:           0,
          zIndex:          100,
          display:         "flex",
          justifyContent:  "space-around",
          alignItems:      "center",
          height:          68,
          paddingBottom:   "env(safe-area-inset-bottom, 0px)",
          background:      "rgba(11,15,16,0.92)",
          backdropFilter:  "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop:       "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const href   = `${base}/${item.segment}`;
          // startsWith so nested sub-routes stay highlighted
          const active = pathname?.startsWith(href) ?? false;

          return (
            <Link
              key={href}
              href={href}
              style={{
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "center",
                gap:            2,
                padding:        "6px 14px",
                borderRadius:   12,
                textDecoration: "none",
                color:          active ? "#e45d35" : "#5a6a74",
                background:     active ? "rgba(228,93,53,0.08)" : "transparent",
                border:         active ? "1px solid rgba(228,93,53,0.15)" : "1px solid transparent",
                transition:     "all 0.2s ease",
                minWidth:       56,
              }}
            >
              <span
                className="nav-ms"
                style={{
                  fontVariationSettings: active
                    ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
                    : "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",
                  color: active ? "#e45d35" : "#5a6a74",
                  transition: "all 0.2s ease",
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontFamily:    "'Geist Mono', monospace",
                  fontSize:      8,
                  fontWeight:    active ? 600 : 400,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color:         active ? "#e45d35" : "#3a4a54",
                  transition:    "all 0.2s ease",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}