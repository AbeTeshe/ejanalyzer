"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";

export default function Sidebar() {
  const [openSubsystems, setOpenSubsystems] = useState(true);
  const [openGSL, setOpenGSL] = useState(false);

  return (
    <aside className="h-screen w-64 bg-gradient-to-b from-[#0b2c5d] to-[#0a1f44] text-white flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-white/10">
        <span className="text-xl font-bold tracking-wide text-red-500">
          Patrika <span className="text-white">vishleshak</span>
        </span>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
        <MenuItem
          icon={<LayoutDashboard size={18} />}
          label="Analyzer"
          href="/analyzer"
        />

        <MenuGroup
          icon={<Briefcase size={18} />}
          label="Sales Documents"
          open={openSubsystems}
          toggle={() => setOpenSubsystems(!openSubsystems)}
        >
          <SubItem label="Cash Sales" href="/sales/cash" />
        </MenuGroup>

        <MenuItem icon={<FileText size={18} />} label="Report" href="/report" />
      </nav>
    </aside>
  );
}

/* ---------- Reusable Parts ---------- */

function MenuItem({ icon, label }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 cursor-pointer">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function MenuGroup({ icon, label, open, toggle, children }) {
  return (
    <div>
      <div
        onClick={toggle}
        className="flex items-center justify-between px-3 py-2 rounded hover:bg-white/10 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span>{label}</span>
        </div>
        {children &&
          (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
      </div>

      {open && children && (
        <div className="ml-6 mt-1 space-y-1">{children}</div>
      )}
    </div>
  );
}

function SubItem({ label }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs rounded hover:bg-white/10 cursor-pointer">
      <span className="w-2 h-2 rounded-full border border-white/60" />
      {label}
    </div>
  );
}
