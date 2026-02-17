"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table";

const Analyzer2= () => {
  const [items, setItems] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const columns = [
    { accessorKey: "customerTin", header: "Customer TIN" },
    { accessorKey: "mrc", header: "MRC" },
    { accessorKey: "fsNo", header: "FS No" },
    { accessorKey: "buyerTin", header: "Buyer TIN" },
    { accessorKey: "date", header: "Date" },
    { accessorKey: "item", header: "Product" },
    { accessorKey: "qty", header: "Qty" },
    { accessorKey: "lineTotal", header: "Line Total" },
    { accessorKey: "grandTotal", header: "Grand Total" },
  ];

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } }
  });

  const cleanValue = (val) => {
    if (!val) return "";
    // Removes currency symbols, asterisks, carets, and commas
    return val.toString().replace(/[\^*,\sBirr:]/g, "").replace(/[^\d.-]/g, "");
  };

  const parseFile = async (file) => {
    const text = await file.text();
    // Split blocks by FS No. or No.NF (to filter out reports later)
    const blocks = text.split(/(?=FS No\.|No\.NF:)/g);
    const allItems = [];

    const footerKeywords = ["TAXBL", "TAX1", "TOTAL", "CASH", "ITEM#", "ERCA"];

    blocks.forEach((block) => {
      // 1. Skip Session Reports (Non-Fiscal)
      if (block.includes("SESSION X REPORT") || block.includes("No.NF:")) return;

      // 2. Metadata Extraction
      const fsNoMatch = block.match(/FS No\.\s*(\d+)/);
      if (!fsNoMatch) return;
      const fsNo = fsNoMatch[1];

      // Capture Date and Time (handles single digit days like 7/7/2024)
      const dateMatch = block.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{2}:\d{2})/);
      const dateStr = dateMatch ? dateMatch[1] : "";
      const timeStr = dateMatch ? dateMatch[2] : "";

      // Capture Grand Total (TOTAL: *15,870.00)
      const grandTotalMatch = block.match(/TOTAL:\s*\*?([\d,.]+)/i);
      const grandTotal = grandTotalMatch ? cleanValue(grandTotalMatch[1]) : "0.00";

      // MRC: Value below ERCA (e.g., CFF0006940)
      const mrcMatch = block.match(/ERCA\s+([A-Z0-9]+)/i);
      const mrc = mrcMatch ? mrcMatch[1] : "CFF0006940";

      const merchantTinMatch = block.match(/TIN:\s*(\d+)/);
      const customerTin = merchantTinMatch ? merchantTinMatch[1] : "0011516616";

      const buyerTinMatch = block.match(/Buyer's TIN:\s*(\d+)/i);
      const buyerTin = buyerTinMatch ? buyerTinMatch[1] : "";

      // 3. Line Processing
      const lines = block.split("\n").map((l) => l.trim()).filter((l) => l);

      let tempReceiptItems = [];
      let pendingQty = 1;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Break at footer
        if (footerKeywords.some((key) => line.toUpperCase().includes(key))) break;

        // Pattern for Quantity: 3 x 2300.00 =
        const qtyMatch = line.match(/^(\d+)\s*x\s*([\d,.]+)\s*=/);
        if (qtyMatch) {
          pendingQty = parseInt(qtyMatch[1]);
          // The next line usually contains the Item Name and Total
          const nextLine = lines[i+1];
          const itemMatch = nextLine ? nextLine.match(/^([A-Z\s\.\^0-9\-]+)\s*\*(-?[\d,.]+)/i) : null;

          if (itemMatch) {
            const name = itemMatch[1].trim();
            const lineTotal = parseFloat(cleanValue(itemMatch[2]));

            tempReceiptItems.push({
              fsNo,
              date: dateStr + " " + timeStr,
              customerTin,
              mrc,
              buyerTin,
              item: name,
              qty: pendingQty,
              lineTotal: lineTotal.toFixed(2),
              grandTotal: grandTotal,
            });
            i++; // skip next line as we processed it
          }
        }
      }
      allItems.push(...tempReceiptItems);
    });

    setItems(allItems);
  };

  const toISO = (raw) => {
    try {
      const parts = raw.trim().split(/\s+/);
      const [d, m, y] = parts[0].split("/");
      const time = parts[1] || "00:00";
      // Ensure leading zeros for date/month for JS Date compatibility
      const pad = (n) => n.padStart(2, '0');
      return new Date(`${y}-${pad(m)}-${pad(d)}T${time}:00Z`).toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  };

  const syncToDatabase = async () => {
    setIsSyncing(true);
    let success = 0;
    for (const it of items) {
      try {
        await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerTin: it.customerTin,
            mrc: it.mrc,
            fsNo: it.fsNo,
            buyerTin: it.buyerTin || null,
            date: toISO(it.date),
            item: it.item,
            qty: Number(it.qty),
            lineTotal: Number(it.lineTotal),
            grandTotal: Number(it.grandTotal)
          }),
        });
        success++;
      } catch (err) {
        console.error("Sync Error:", err);
      }
    }
    setIsSyncing(false);
    alert(`Successfully saved ${success} items to Database`);
    setItems([])
  };

  return (
    <div className=" max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg  mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Receipt Analyzer <span className="text-xs font-normal text-gray-500">v3.0 (MRC below ERCA)</span></h1>
        <div className="flex gap-3">
          <input
            type="file"
            onChange={(e) => parseFile(e.target.files[0])}
            className="text-sm file:bg-blue-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-lg cursor-pointer"
          />
          {items.length > 0 && (
            <button 
              onClick={syncToDatabase} 
              disabled={isSyncing}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold disabled:bg-gray-400"
            >
              {isSyncing ? "Saving..." : "Save to DB"}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow  overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-100 border-b">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th key={header.id} className="px-4 py-3 text-left font-bold uppercase">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="border-b hover:bg-blue-50">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="p-4 flex justify-between items-center bg-gray-50">
          <span className="text-xs text-gray-500">Total Items Found: {items.length}</span>
          <div className="flex gap-2">
            <button onClick={() => table.previousPage()} className="px-3 py-1 border rounded bg-white text-xs">Prev</button>
            <button onClick={() => table.nextPage()} className="px-3 py-1 border rounded bg-white text-xs">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analyzer2