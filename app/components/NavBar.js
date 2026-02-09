"use client";

import { Bell, User, LogOut } from "lucide-react";

export default function Navbar() {
  return (
    <header className="h-14 bg-white shadow-sm flex items-center justify-between px-2">
      <div className="text-sm text-gray-600 font-medium">
        Receipt Analyzer System
      </div>

      <div className="flex items-center gap-4">
        <Bell size={18} className="text-gray-600 cursor-pointer" />

        <div className="flex items-center gap-2 cursor-pointer">
          <User size={18} />
          <span className="text-sm">Abebe</span>
        </div>

        <LogOut size={18} className="text-gray-600 cursor-pointer" />
      </div>
    </header>
  );
}
