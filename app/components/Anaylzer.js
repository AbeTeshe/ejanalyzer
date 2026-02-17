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

const Analyzer = () => {
  const [items, setItems] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const columns = [
    
    { accessorKey: "mrc", header: "MRC" },
    { accessorKey: "fsNo", header: "FS No" },
    { accessorKey: "buyerTin", header: "Buyer TIN" },
    { accessorKey: "date", header: "Date" },
    { accessorKey: "item", header: "Product" },
    { accessorKey: "qty", header: "Qty" },
    { accessorKey: "lineTotal", header: "Line Total" },
    { accessorKey: "grandTotal", header: "Grand Total" }, // New Column
  ];

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
        pagination: { pageSize: 20 }
    }
  });

  const cleanValue = (val) => {
    if (!val) return "";
    // Removes ^, *, commas, and spaces, keeping numbers and dots
    return val.toString().replace(/[\^*,\s]/g, "").replace(/[^\d.-]/g, "");
  };

  const parseFile = async (file) => {
    const text = await file.text();
    const blocks = text.split(/FS No\.\s+/).slice(1);
    const allItems = [];

    const footerKeywords = [
      "TXBL1", "TAX1", "TOTAL", "CASH", "ITEM#", "CHANGE", "SESSION Z REPORT",
    ];

    blocks.forEach((block) => {
      // 1. Metadata Extraction
      const fsNoMatch = block.match(/^(\d+)/);
      if (!fsNoMatch) return;
      const fsNo = cleanValue(fsNoMatch[1]);

      const dateMatch = block.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
      const date = dateMatch ? dateMatch[0] : "";

      // Capture Grand Total (Handles the ^T^O^T^A^L pattern)
      const grandTotalMatch = block.match(/\^T\^O\^T\^A\^L\s+\*?\^?([\d,.\^]+)/i);
      const grandTotal = grandTotalMatch ? cleanValue(grandTotalMatch[1]) : "0.00";

      const merchantTinMatch = block.match(/TIN:\s*(0011516616)/);
      const machineIdMatch = block.match(/FGE\d+/); // Improved machine ID regex
      
      const customerTin = merchantTinMatch ? cleanValue(merchantTinMatch[1]) : "0011516616";
      const mrc = machineIdMatch ? machineIdMatch[0] : "FGE0010870";
      const buyerTinMatch = block.match(/BUYER'S TIN:\s*(\d+)/i);
      const buyerTin = buyerTinMatch ? cleanValue(buyerTinMatch[1]) : "";

      // 2. Line Processing
      const lines = block.split("\n").map((l) => l.trim()).filter((l) => l);

      let tempReceiptItems = [];
      let pendingQty = 1;
      let pendingUnitPrice = null;

      for (let line of lines) {
        // Break only if it's a standard total, not the ^T^O^T^A^L we are looking for
        if (footerKeywords.some((key) => line.toUpperCase() === key)) break;
        if (/[–-]{5,}/.test(line)) break;

        const qtyMatch = line.match(/^(-?\d+)\s*x\s*\*([\d,.]+)/);
        const itemMatch = line.match(/^([A-Z\s\.\^0-9\-]+)\s*\*(-?[\d,.]+)/i);

        if (qtyMatch) {
          pendingQty = parseInt(qtyMatch[1]);
          pendingUnitPrice = parseFloat(cleanValue(qtyMatch[2]));
        } else if (itemMatch) {
          const name = itemMatch[1].replace(/\^/g, "").trim();
          const lineTotal = parseFloat(cleanValue(itemMatch[2]));

          if (name === fsNo || name === date || name.includes("TIN") || name.length < 2) continue;

          const unitPrice = pendingUnitPrice !== null ? pendingUnitPrice : lineTotal;

          tempReceiptItems.push({
            fsNo,
            date,
            customerTin,
            mrc,
            buyerTin,
            item: name,
            qty: pendingQty,
            unitPrice: Math.abs(unitPrice).toFixed(2),
            lineTotal: lineTotal,
            grandTotal: grandTotal, // Assign grand total to each line
          });

          pendingQty = 1;
          pendingUnitPrice = null;
        }
      }

      // 3. Mathematical Void Filtering
      const survivors = [];
      const usedIndices = new Set();

      for (let i = 0; i < tempReceiptItems.length; i++) {
        if (usedIndices.has(i)) continue;
        const current = tempReceiptItems[i];

        if (current.lineTotal > 0) {
          const voidIdx = tempReceiptItems.findIndex(
            (target, idx) =>
              idx > i &&
              !usedIndices.has(idx) &&
              target.item === current.item &&
              Math.abs(target.lineTotal + current.lineTotal) < 0.01,
          );

          if (voidIdx !== -1) {
            usedIndices.add(i);
            usedIndices.add(voidIdx);
          } else {
            current.lineTotal = current.lineTotal.toFixed(2);
            survivors.push(current);
          }
        }
      }
      allItems.push(...survivors);
    });

    setItems(allItems);
    
  };

  const syncToDatabase = async () => {
    setIsSyncing(true);
    let success = 0;
    
    for (const it of items) {
      try {
        const parts = it.date.trim().split(/\s+/);
        const [d, m, y] = parts[0].split("/");
        const time = parts[1] || "00:00";
        const isoDate = new Date(`${y}-${m}-${d}T${time}:00Z`).toISOString();

        await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...it,
            date: isoDate,
            lineTotal: Number(it.lineTotal),
            grandTotal: Number(it.grandTotal)
          }),
        });
        success++;
      } catch (err) {
        console.error(err);
      }
    }
    setIsSyncing(false);
    alert(`Successfully saved ${success} items to Database`);
    setItems([])
  };

  
  return (
    <div className=" max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg  mb-1 flex flex-wrap items-center justify-between">
        <h1 className="text-lg font-black text-gray-900 tracking-tight">
          Receipt Analyzer <span className="text-blue-600">v2</span>
        </h1>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".txt"
            onChange={(e) => parseFile(e.target.files[0])}
            className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
          />
          {items.length > 0 && (
            <>
              <button onClick={syncToDatabase} disabled={isSyncing} className="bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold disabled:opacity-50">
                {isSyncing ? "Syncing..." : "Sync to DB"}
              </button>
              <button onClick={() => {
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), "Data");
                XLSX.writeFile(wb, "Receipt_GrandTotals.xlsx");
              }} className="bg-green-600 text-white px-4 py-2 rounded-full text-xs font-bold">
                Excel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full text-[11px]">
          <thead className="bg-gray-100 text-black border-b">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left font-bold uppercase cursor-pointer" onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-blue-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination UI */}
        <div className="flex items-center justify-between p-4 text-[11px] bg-gray-50 border-t">
            <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
            <div className="flex gap-1">
                <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="px-2 py-1 border rounded bg-white disabled:opacity-30">Prev</button>
                <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="px-2 py-1 border rounded bg-white disabled:opacity-30">Next</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Analyzer;