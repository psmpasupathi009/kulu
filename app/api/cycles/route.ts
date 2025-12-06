import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const createCycleSchema = z.object({
  groupId: z.string().optional(), // Optional group - can work without groups
  memberId: z.string().min(1, "Member is required"), // Member receiving the loan
  loanAmount: z.number().positive("Loan amount must be positive"),
  loanWeeks: z
    .number()
    .int()
    .positive("Loan duration must be positive")
    .default(10),
  reason: z.string().optional(), // Reason for the loan
  disbursedAt: z.string().optional(), // Optional disbursal date
  disbursementMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(), // Payment method for disbursement
  guarantor1Id: z.string().optional(),
  guarantor2Id: z.string().optional(),
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

    const cycles = await prisma.loanCycle.findMany({
      include: {
        loans: {
          include: { member: true },
        },
        sequences: {
          include: { member: true },
          orderBy: { week: "asc" },
        },
        groupFund: true,
      },
      orderBy: { cycleNumber: "desc" },
    });

    return NextResponse.json({ cycles }, { status: 200 });
  } catch (error) {
    console.error("Error fetching cycles:", error);
    return NextResponse.json(
      { error: "Failed to fetch cycles" },
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
    const data = createCycleSchema.parse(body);

    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: data.memberId },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Get group if provided, otherwise work without group
    let group = null;
    let groupMember = null;
    let weeklyAmount = 100; // Default weekly amount

    if (data.groupId) {
      group = await prisma.group.findUnique({
        where: { id: data.groupId },
      });

      if (!group) {
        return NextResponse.json(
          { error: "Group not found" },
          { status: 404 }
        );
      }

      groupMember = await prisma.groupMember.findUnique({
        where: {
          groupId_memberId: {
            groupId: data.groupId,
            memberId: data.memberId,
          },
        },
      });

      if (!groupMember || !groupMember.isActive) {
        return NextResponse.json(
          { error: "Member not found in group or is inactive" },
          { status: 404 }
        );
      }

      weeklyAmount = group.weeklyAmount || 100;
    }

    // Get the next cycle number (for group if provided, or global if no group)
    const lastCycle = await prisma.loanCycle.findFirst({
      where: data.groupId ? { groupId: data.groupId } : { groupId: null },
      orderBy: { cycleNumber: "desc" },
    });

    const cycleNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;

    // Check if cycle with this number already exists (only if group provided)
    if (data.groupId) {
      const existingCycle = await prisma.loanCycle.findUnique({
        where: {
          groupId_cycleNumber: {
            groupId: data.groupId,
            cycleNumber: cycleNumber,
          },
        },
      });

      if (existingCycle) {
        return NextResponse.json(
          { error: "Cycle number already exists for this group" },
          { status: 400 }
        );
      }
    }

    // Calculate start date (disbursal date or now)
    const startDate = data.disbursedAt
      ? new Date(data.disbursedAt)
      : new Date();

    // Create cycle and loan in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get current group fund balance from previous cycles or initialize
      // For now, we'll start with 0 and funds will be added through collections
      const cycle = await tx.loanCycle.create({
        data: {
          cycleNumber: cycleNumber,
          groupId: data.groupId || null,
          startDate: startDate,
          weeklyAmount: weeklyAmount,
          isActive: true,
          groupFund: {
            create: {
              investmentPool: 0, // Will be filled by member contributions via collections
              totalFunds: 0,
            },
          },
        },
      });

      // Create and disburse the loan
      // Note: reason field is optional in schema
      const loan = await tx.loan.create({
        data: {
          memberId: data.memberId,
          cycleId: cycle.id,
          principal: data.loanAmount,
          remaining: data.loanAmount,
          weeks: data.loanWeeks,
          currentWeek: 0,
          status: "ACTIVE",
          disbursedAt: startDate,
          disbursementMethod: data.disbursementMethod || null,
          guarantor1Id: data.guarantor1Id || null,
          guarantor2Id: data.guarantor2Id || null,
          // reason is optional - only include if provided and Prisma client supports it
          ...(data.reason && { reason: data.reason }),
        },
      });

      // Update group member's total received (if in a group)
      if (groupMember) {
        await tx.groupMember.update({
          where: { id: groupMember.id },
          data: {
            totalReceived: {
              increment: data.loanAmount,
            },
          },
        });
      }

      // Deduct loan amount from group fund's investment pool
      // The loan comes from the group's pooled funds (member contributions)
      // Get the group fund that was just created
      const groupFund = await tx.groupFund.findUnique({
        where: { cycleId: cycle.id },
      });
      
      if (groupFund) {
        // Note: If investment pool is 0 or less than loan amount, that's okay
        // The loan is disbursed from future member contributions
        // We track the deduction for accounting purposes
        await tx.groupFund.update({
          where: { id: groupFund.id },
          data: {
            investmentPool: {
              decrement: data.loanAmount,
            },
            totalFunds: {
              decrement: data.loanAmount,
            },
          },
        });
      }

      return { cycle, loan };
    });

    return NextResponse.json(
      {
        cycle: result.cycle,
        loan: result.loan,
        message: "Loan cycle created and loan disbursed successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating cycle:", error);
    return NextResponse.json(
      { error: "Failed to create cycle" },
      { status: 500 }
    );
  }
}
