"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

const NAV_ITEMS = [
  { segment: "bid",     icon: "gavel",    label: "Auction" },
  { segment: "squad",   icon: "groups",   label: "Squad"   },
  { segment: "budget",  icon: "payments", label: "Budget"  },
  { segment: "history", icon: "reorder",  label: "History" },
];

export default function BottomNavBar() {
  const pathname = usePathname();
  const params   = useParams();

  const auctionId = params?.auctionId as string;
  const teamCode  = params?.teamCode  as string;

  const base = `/owner/${auctionId}/${teamCode}`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center h-20 px-2 pb-safe bg-[rgba(16,20,21,0.85)] backdrop-blur-2xl border-t border-white/10">
      {NAV_ITEMS.map((item) => {
        const href   = `${base}/${item.segment}`;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={[
              "flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-300",
              active
                ? "text-[#e45d35] bg-[rgba(228,93,53,0.1)]"
                : "text-[#c6c6cd] hover:bg-white/5",
            ].join(" ")}
          >
            <span
              className="material-symbols-outlined text-2xl"
              style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
            >
              {item.icon}
            </span>
            <span className="font-['Geist'] text-xs">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}