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
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });
  const columns = [
    { accessorKey: "customerTin", header: "Customer TIN" },
    { accessorKey: "mrc", header: "MRC" },
    { accessorKey: "fsNo", header: "FS No" },
    { accessorKey: "buyerTin", header: "Buyer TIN" },
    { accessorKey: "date", header: "Date" },
    { accessorKey: "item", header: "Product" },
    { accessorKey: "qty", header: "Qty" },
    { accessorKey: "lineTotal", header: "Total" },
  ];

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Helper to strip non-numeric characters except decimals
  const cleanValue = (val) => {
    if (!val) return "";
    return val.toString().replace(/[^\d.-]/g, "");
  };

  const parseFile = async (file) => {
    const text = await file.text();
    const blocks = text.split(/FS No\.\s+/).slice(1);
    const allItems = [];

    const footerKeywords = [
      "TXBL1",
      "TAX1",
      "TOTAL",
      "CASH",
      "ITEM#",
      "CHANGE",
      "^T^O^T^A^L",
      "SESSION Z REPORT",
    ];

    blocks.forEach((block) => {
      // 1. Metadata Extraction
      const fsNoMatch = block.match(/^(\d+)/);
      if (!fsNoMatch) return;
      const fsNo = cleanValue(fsNoMatch[1]); // Clean FS Number

      const dateMatch = block.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
      const date = dateMatch ? dateMatch[0] : "";

      const merchantTinMatch = block.match(/TIN:\s*(0011516616)/);
      const machineIdMatch = block.match(/{logo}\d+/);
      const buyerTinMatch = block.match(/BUYER'S TIN:\s*(\d+)/i);

      const customerTin = merchantTinMatch
        ? cleanValue(merchantTinMatch[1])
        : "0011516616";
      const mrc = machineIdMatch ? machineIdMatch[0] : "FGE0010870";
      const buyerTin = buyerTinMatch ? cleanValue(buyerTinMatch[1]) : "";

      // 2. State-Based Line Processing
      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l);

      let tempReceiptItems = [];
      let pendingQty = 1;
      let pendingUnitPrice = null;

      for (let line of lines) {
        if (footerKeywords.some((key) => line.toUpperCase().includes(key)))
          break;
        if (/[–-]{5,}/.test(line)) break;

        const qtyMatch = line.match(/^(-?\d+)\s*x\s*\*([\d,.]+)/);
        const itemMatch = line.match(/^([A-Z\s\.\^0-9\-]+)\s*\*(-?[\d,.]+)/i);

        if (qtyMatch) {
          pendingQty = parseInt(qtyMatch[1]);
          pendingUnitPrice = parseFloat(cleanValue(qtyMatch[2]));
        } else if (itemMatch) {
          const name = itemMatch[1].replace(/\^/g, "").trim();
          const lineTotal = parseFloat(cleanValue(itemMatch[2]));

          if (
            name === fsNo ||
            name === date ||
            name.includes("TIN") ||
            name.length < 2
          )
            continue;

          const unitPrice =
            pendingUnitPrice !== null ? pendingUnitPrice : lineTotal;

          tempReceiptItems.push({
            fsNo,
            date,
            customerTin,
            mrc,
            buyerTin,
            item: name,
            qty: pendingQty,
            unitPrice: Math.abs(unitPrice).toFixed(2),
            lineTotal: lineTotal, // Raw number for math
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
            // Convert to clean string for final output
            current.lineTotal = current.lineTotal.toFixed(2);
            survivors.push(current);
          }
        }
      }
      allItems.push(...survivors);
    });

    setItems(allItems);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(items),
      "Clean Sales Data",
    );
    XLSX.writeFile(wb, "Receipt_Data_Clean_Values.xlsx");
  };

  function toISO(raw) {
    const parts = raw.trim().split(/\s+/);
    const [d, m, y] = parts[0].split("/");
    const time = parts[1] || "00:00";

    return new Date(`${y}-${m}-${d}T${time}:00Z`).toISOString();
  }

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
            buyerTin: it.buyerTin,
            date: toISO(it.date),
            item: it.item,
            qty: it.qty,
            lineTotal: it.lineTotal,
          }),
        });
        success++;
      } catch (err) {
        console.error(err);
      }
    }
    setIsSyncing(false);
    alert(`Successfully saved ${success} items to Database`);
  };

  return (
    <div className="p-2 max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen">
      <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200 mb-3 text-center flex items-center">
        <h1 className="text-lg font-black text-gray-900 tracking-tight mr-2">
          Receipt Analyzer
        </h1>
        <div className="my-1 flex justify-center items-center gap-4">
          <input
            type="file"
            accept=".txt"
            onChange={(e) => parseFile(e.target.files[0])}
            className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer shadow-md"
          />
          {items.length > 0 && (
            <>
              <button
                onClick={syncToDatabase}
                disabled={isSyncing}
                className="bg-indigo-600 text-white px-8 py-2 rounded-full font-bold hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {isSyncing ? "Saving..." : "Save to Database"}
              </button>
              <button
                onClick={() => {
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(
                    wb,
                    XLSX.utils.json_to_sheet(items),
                    "Data",
                  );
                  XLSX.writeFile(wb, "Receipts.xlsx");
                }}
                className="bg-green-600 text-white px-8 py-2 rounded-full font-bold hover:bg-green-700"
              >
                Excel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-100 text-black">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left font-bold uppercase cursor-pointer select-none"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getIsSorted() === "asc" && " ↑"}
                    {header.column.getIsSorted() === "desc" && " ↓"}
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

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 text-xs bg-gray-50">
          <div>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              ⏮ First
            </button>

            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              ◀ Prev
            </button>

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Next ▶
            </button>

            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Last ⏭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analyzer;
