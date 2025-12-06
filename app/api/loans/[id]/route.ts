import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const updateLoanSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "COMPLETED", "DEFAULTED"]).optional(),
  guarantor1Id: z.string().optional(),
  guarantor2Id: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        member: true,
        cycle: true,
        sequence: true,
        guarantor1: true,
        guarantor2: true,
        transactions: {
          orderBy: { date: "desc" },
        },
        interestDistributions: {
          include: {
            groupMember: {
              include: {
                member: true,
              },
            },
          },
          orderBy: { distributionDate: "desc" },
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    return NextResponse.json({ loan }, { status: 200 });
  } catch (error) {
    console.error("Error fetching loan:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const data = updateLoanSchema.parse(body);

    const updateData: Prisma.LoanUpdateInput = {};
    if (data.status) updateData.status = data.status;
    if (data.guarantor1Id !== undefined) {
      updateData.guarantor1 = data.guarantor1Id
        ? { connect: { id: data.guarantor1Id } }
        : { disconnect: true };
    }
    if (data.guarantor2Id !== undefined) {
      updateData.guarantor2 = data.guarantor2Id
        ? { connect: { id: data.guarantor2Id } }
        : { disconnect: true };
    }

    const loan = await prisma.loan.update({
      where: { id },
      data: updateData,
      include: {
        member: true,
        cycle: true,
        sequence: true,
        guarantor1: true,
        guarantor2: true,
        transactions: {
          orderBy: { date: "desc" },
        },
      },
    });

    return NextResponse.json({ loan }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating loan:", error);
    return NextResponse.json(
      { error: "Failed to update loan" },
      { status: 500 }
    );
  }
}
