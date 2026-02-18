"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table";

const DatecsAnalyzer = () => {
  const [items, setItems] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const cleanValue = (val) => {
    if (!val) return "";
    return val.toString().replace(/[\^*,\sBirr:]/g, "").replace(/[^\d.-]/g, "");
  };

  const parseFile = async (file) => {
    const text = await file.text();
    // Split by FS No. to handle multiple receipts in one file
    const blocks = text.split(/FS No\./g).slice(1);
    const allItems = [];

    blocks.forEach((block) => {
      // 1. Metadata extraction using specific regex for this format
      const fsNoMatch = block.match(/^(\d+)/);
      const fsNo = fsNoMatch ? fsNoMatch[1] : "UNKNOWN";

      const dateMatch = block.match(/DATE:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
      const dateStr = dateMatch ? dateMatch[1] : "";

      const customerNameMatch = block.match(/Customer:\s*([^\n\r]+)/i);
      const customerName = customerNameMatch ? customerNameMatch[1].trim() : "CASH";

      const buyerTinMatch = block.match(/Customers TIN:\s*(\d+)/i);
      const buyerTin = buyerTinMatch ? buyerTinMatch[1] : "";

      const refMatch = block.match(/Ref:\s*([^\n\r]+)/i);
      const ref = refMatch ? refMatch[1].trim() : "";

      const operatorMatch = block.match(/Operator:\s*([^\n\r]+)/i);
      const operator = operatorMatch ? operatorMatch[1].trim() : "";

      const grandTotalMatch = block.match(/TOTAL\s+\*?([\d,.]+)/i);
      const grandTotal = grandTotalMatch ? cleanValue(grandTotalMatch[1]) : "0.00";

      // MRC Logic: Finds the ID after the second {logo}
      const mrcMatch = block.match(/{logo}\s+([A-Z0-9]+)/i);
      const mrc = mrcMatch ? mrcMatch[1] : "";

      // 2. Item Extraction (The "Hard" Part)
      // We look for lines that contain the Qty and Unit Price (e.g., "30 939.130")
      const lines = block.split("\n").map(l => l.trim()).filter(l => l);
      
      for (let i = 0; i < lines.length; i++) {
        // This regex looks for: [Numbers] [Space] [Numbers with decimals]
        // This represents the QTY and the PRICE line
        const qtyPriceMatch = lines[i].match(/^(\d+)\s+(\d+\.\d{2,3})$/);

        if (qtyPriceMatch) {
          const qty = qtyPriceMatch[1];
          const unitPrice = qtyPriceMatch[2];

          // The line BEFORE the qty/price is usually the Product Name
          let productName = lines[i-1] || "Unknown Item";
          
          // If the name is just "LRM" or something short, go back one more line
          if (productName.length < 5 && lines[i-2]) {
            productName = lines[i-2] + " " + productName;
          }

          // The line AFTER the qty/price is the Line Total (e.g., *28,173.90)
          const totalLine = lines[i+1];
          const totalMatch = totalLine ? totalLine.match(/\*([\d,.]+)/) : null;
          const lineTotal = totalMatch ? cleanValue(totalMatch[1]) : (parseFloat(qty) * parseFloat(unitPrice)).toFixed(2);

          // Only add if it's not a tax line
          if (!productName.includes("TXBL") && !productName.includes("TOTAL")) {
            allItems.push({
              fsNo,
              date: dateStr,
              customerName,
              buyerTin,
              item: productName.replace(/----------------/g, "").trim(),
              qty: parseInt(qty),
              unitPrice: parseFloat(unitPrice).toFixed(2),
              lineTotal: lineTotal,
              grandTotal,
              ref,
              operator,
              mrc
            });
          }
        }
      }
    });

    if (allItems.length === 0) {
      alert("No data found. Please check if the file format matches.");
    }
    setItems(allItems);
  };

  const columns = [
    { accessorKey: "fsNo", header: "FS No" },
    { accessorKey: "date", header: "Date" },
    { accessorKey: "customerName", header: "Customer" },
    { accessorKey: "item", header: "Product" },
    { accessorKey: "qty", header: "Qty" },
    { accessorKey: "lineTotal", header: "Total" },
    { accessorKey: "mrc", header: "MRC" },
  ];

  console.log(items)

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } }
  });

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="bg-white p-6 rounded-xl shadow-md mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Receipt Processor <span className="text-blue-500">v4.1</span></h1>
        <input 
          type="file" 
          onChange={(e) => parseFile(e.target.files[0])} 
          className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-800 text-white">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id} className="p-4 font-semibold">{flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-blue-50 transition">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="p-4">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="p-10 text-center text-gray-400">Upload a .txt file to see results</div>}
      </div>
    </div>
  );
};

export default DatecsAnalyzer;


