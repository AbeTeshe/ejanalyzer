// app/api/transactions/route.js

import prisma from "../../lib/prisma";
import { parse } from "date-fns";

export async function GET(req) {
  try {
    const transactions = await prisma.transactions.findMany({ include: { lineitems: true } });
    console.log(transactions)
    return new Response(JSON.stringify(transactions), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch transactions" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}



export async function POST(req) {
  try {
    const body = await req.json();

    const {
      fsNo,
      date,
      customerTin,
      mrc,
      buyerTin,
      item,
      qty,
      unitPrice,
      lineTotal,
      grandTotal,
    } = body;

    if (!fsNo || !date || !item) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Upsert transaction and add line item only if not exists
const transaction = await prisma.transactions.upsert({
  where: {
    mrc_fsNo: {
      mrc,
      fsNo,
    },
  },
  update: {
    // Update grandTotal if needed
    grandTotal: Number(grandTotal),
  },
  create: {
    fsNo,
    date: new Date(date),
    customerTin,
    mrc,
    buyerTin,
    grandTotal: Number(grandTotal),
    lineitems: {
      create: {
        item,
        quantity: Number(qty),
        unitAmount: Number(unitPrice),
        totalAmount: Number(lineTotal),
        vatAmount: Number(lineTotal) * 0.15,
      },
    },
  },
  include: {
    lineitems: true,
  },
});

// Check if the line item already exists for this transaction
const existingLineItem = transaction.lineitems.find(
  (li) => li.item === item
);

if (!existingLineItem) {
  // If line item doesn't exist, create it
  await prisma.lineitems.create({
    data: {
      transactionId: transaction.id, // link to the transaction
      item,
      quantity: Number(qty),
      unitAmount: Number(unitPrice),
      totalAmount: Number(lineTotal),
      vatAmount: Number(lineTotal) * 0.15,
    },
  });
}


    return Response.json(transaction, { status: 201 });
  } catch (error) {
    console.error("POST /api/transactions error:", error);
    return Response.json(
      { error: "Failed to save transaction" },
      { status: 500 }
    );
  }
}



