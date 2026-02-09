// app/api/transactions/route.js

import prisma from "@/app/lib/prisma";

export async function GET(req) {
  try {
    const transactions = await prisma.transaction.findMany();
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

    const transaction = await prisma.transaction.create({
      data: {
        customerTin: body.customerTin,
        mrc: body.mrc,
        fsNo: body.fsNo,
        buyerTin: body.buyerTin || null,
        date: new Date(body.date), // important
        item: body.item,
        qty: Number(body.qty),
        lineTotal: Number(body.lineTotal),
      },
    });

    return Response.json(
      {
        ...transaction,
        date: transaction.date.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to create" }, { status: 500 });
  }
}
