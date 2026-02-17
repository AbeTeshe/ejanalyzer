"use client";
import React, { useState } from "react";
import Analyzer from "./Anaylzer";
import Analyzer2 from "./Anaylzer2";


const AnalyzersPage = () => {
  const [type, setType] = useState("FGE");

  const btnClass = (value) =>
    `px-4 py-2 text-sm font-semibold transition
     ${type === value
       ? "bg-blue-600 text-white"
       : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`;

  return (
    <div className="bg-white p-2 rounded-xl shadow border border-gray-200 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">
          Machine Type
        </h1>

        {/* Button group */}
        <div className="inline-flex rounded-lg overflow-hidden border">
          <button onClick={() => setType("FGE")} className={btnClass("FGE")}>
            FGE
          </button>
          <button onClick={() => setType("CFF")} className={btnClass("CFF")}>
            CFF
          </button>
          <button onClick={() => setType("Datecs")} className={btnClass("Datecs")}>
            Datecs
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="pt-4">
        {type === "FGE" && <Analyzer />}
        {type === "CFF" && <Analyzer2 />}
        {type === "Datecs" && (
          <div className="text-gray-500 italic">
            Datecs analyzer coming soon...
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyzersPage;
