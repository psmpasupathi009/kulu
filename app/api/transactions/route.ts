import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";
import { TransactionType } from "@prisma/client";

const createTransactionSchema = z.object({
  memberId: z.string(),
  type: z.enum(["SAVINGS", "LOAN", "MISCELLANEOUS", "COLLECTION"]),
  date: z.string(),
  purpose: z.string().optional(),
  amount: z.number().positive(),
  photo: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");

    const where =
      type && Object.values(TransactionType).includes(type as TransactionType)
        ? { type: type as TransactionType }
        : {};

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        member: true,
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ transactions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = createTransactionSchema.parse(body);

    const transaction = await prisma.transaction.create({
      data: {
        memberId: data.memberId,
        type: data.type,
        date: new Date(data.date),
        purpose: data.purpose,
        amount: data.amount,
        photo: data.photo,
      },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
