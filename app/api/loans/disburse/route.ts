import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const disburseLoanSchema = z.object({
  sequenceId: z.string(),
  disbursedAt: z.string().optional(),
  guarantor1Id: z.string().optional(),
  guarantor2Id: z.string().optional(),
});

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
    const data = disburseLoanSchema.parse(body);

    // Get sequence with cycle and member
    const sequence = await prisma.loanSequence.findUnique({
      where: { id: data.sequenceId },
      include: {
        cycle: {
          include: { groupFund: true },
        },
        member: true,
      },
    });

    if (!sequence) {
      return NextResponse.json(
        { error: "Loan sequence not found" },
        { status: 404 }
      );
    }

    if (sequence.status === "DISBURSED") {
      return NextResponse.json(
        { error: "Loan already disbursed" },
        { status: 400 }
      );
    }

    // Check if group fund has enough money
    if (sequence.cycle?.groupFund) {
      const groupFund = sequence.cycle.groupFund;
      if (groupFund.totalFunds < sequence.loanAmount) {
        return NextResponse.json(
          {
            error: "Insufficient funds in group pool",
            available: groupFund.totalFunds,
            required: sequence.loanAmount,
          },
          { status: 400 }
        );
      }
    }

    // Get cycle with group to determine interest rate
    const cycle = await prisma.loanCycle.findUnique({
      where: { id: sequence.cycleId },
      include: { group: true },
    });

    // ROSCA: 2% interest rate, 10 weeks repayment
    const interestRate = cycle?.group?.interestRate || 2.0;
    const loanWeeks = cycle?.group?.loanWeeks || 10;

    // Create loan
    const loan = await prisma.loan.create({
      data: {
        memberId: sequence.memberId,
        cycleId: sequence.cycleId,
        sequenceId: sequence.id,
        principal: sequence.loanAmount,
        remaining: sequence.loanAmount,
        interestRate: interestRate, // 2% per week for ROSCA
        interestMethod: "DECLINING", // Recommended method
        weeks: loanWeeks, // 10 weeks for ROSCA
        currentWeek: 0,
        status: "ACTIVE",
        disbursedAt: new Date(data.disbursedAt || new Date()),
        guarantor1Id: data.guarantor1Id || null,
        guarantor2Id: data.guarantor2Id || null,
      },
      include: {
        member: true,
        cycle: true,
        sequence: true,
      },
    });

    // Update sequence
    await prisma.loanSequence.update({
      where: { id: sequence.id },
      data: {
        status: "DISBURSED",
        disbursedAt: new Date(data.disbursedAt || new Date()),
      },
    });

    // Update group fund - deduct loan amount from investment pool
    if (sequence.cycle?.groupFund) {
      await prisma.groupFund.update({
        where: { id: sequence.cycle.groupFund.id },
        data: {
          investmentPool: {
            decrement: sequence.loanAmount,
          },
          totalFunds: {
            decrement: sequence.loanAmount,
          },
        },
      });
    }

    return NextResponse.json(
      {
        loan,
        message: "Loan disbursed successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error disbursing loan:", error);
    return NextResponse.json(
      { error: "Failed to disburse loan" },
      { status: 500 }
    );
  }
}
