"use client";
import { useState } from "react";

export default function ZeroFSFinder() {
  const [fsList, setFsList] = useState([]);

  const parseFile = async (file) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/);

    const receipts = [];
    let current = null;

    // Build FS blocks safely
    for (let line of lines) {
      const fs = line.match(/FS No\.\s*(\d+)/);
      if (fs) {
        if (current) receipts.push(current);
        current = { fsNo: fs[1], raw: [] };
      } else if (current) {
        current.raw.push(line);
      }
    }
    if (current) receipts.push(current);

    const zeroFS = [];

    receipts.forEach((r) => {
      // Normalize block (remove ^ and extra spaces)
      const clean = r.raw
        .join("\n")
        .replace(/\^/g, "")
        .replace(/\s+/g, " ")
        .toUpperCase();

      // Extract TOTAL
      const totalMatch = clean.match(/TOTAL\s*\*?\s*([\d.,]+)/);
      const total = totalMatch
        ? parseFloat(totalMatch[1].replace(/,/g, ""))
        : null;

      // Extract ITEM#
      const itemMatch = clean.match(/ITEM#\s*(\d+)/);
      const items = itemMatch ? parseInt(itemMatch[1]) : null;

      if (total === 0 && items === 0) {
        zeroFS.push({
          fsNo: r.fsNo,
          total,
          items,
        });
      }
    });

    setFsList(zeroFS);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Zero Fiscal Receipts</h1>

      <input
        type="file"
        accept=".txt"
        onChange={(e) => parseFile(e.target.files[0])}
      />

      {fsList.length > 0 && (
        <div className="bg-gray-100 p-4 rounded">
          <p className="font-semibold">Found {fsList.length} zero receipts:</p>
          <ul className="list-disc ml-5">
            {fsList.map((r, i) => (
              <li key={i}>
                FS No: <b>{r.fsNo}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
