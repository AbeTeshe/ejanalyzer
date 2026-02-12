// app/api/transactions/route.js

import prisma from "@/app/lib/prisma";
import { parse } from "date-fns";

export async function GET(req) {
  try {
    const transactions = await prisma.transaction.findMany({ include: { lineItems: true } });
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

    // Parse date from dd/MM/yyyy HH:mm format
    const parsedDate = parse(body.date, "dd/MM/yyyy HH:mm", new Date());

    // 1. Find or create transaction
    let transaction = await prisma.transaction.findFirst({
      where: {
        mrc: body.mrc,
        fsNo: body.fsNo,
      },
    });

    if (!transaction) {
      transaction = await prisma.transaction.create({
        data: {
          customerTin: body.customerTin || "",
          mrc: body.mrc,
          fsNo: body.fsNo,
          buyerTin: body.buyerTin || null,
          date: parsedDate,
          grandTotal: Number(body.grandTotal) || 0,
        },
      });
    }

    // 2. Create line item
    const lineItem = await prisma.lineItem.create({
      data: {
        transactionId: transaction.id,
        item: body.item,
        unitAmount: Number(body.unitPrice),
        quantity: Number(body.qty),
        totalAmount: Number(body.lineTotal),
        vatAmount: Number(body.grandTotal) - Number(body.lineTotal),
      },
    });

    // 3. Optionally update transaction grandTotal if you want sum of all line items
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        grandTotal: { increment: Number(body.grandTotal) }, // or recalc from lineItems
      },
    });

    return new Response(
      JSON.stringify({ transaction, lineItem }),
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: "Failed to save receipt" }),
      { status: 500 }
    );
  }
}


