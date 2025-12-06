import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  calculateWeeklyPayment,
  calculateGroupFundAllocation,
} from "@/lib/utils";

const repayLoanSchema = z.object({
  loanId: z.string(),
  paymentDate: z.string().optional(), // Optional, defaults to now
  isLate: z.boolean().default(false),
  overdueWeeks: z.number().int().min(0).default(0),
});

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const data = repayLoanSchema.parse(body);

    // Get loan with member and cycle info
    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: {
        member: true,
        cycle: {
          include: {
            groupFund: true,
            group: {
              include: {
                members: {
                  where: { isActive: true },
                  include: { member: true },
                },
              },
            },
          },
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Non-admin users can only repay their own loans
    // Check if user's userId matches member's userId
    if (user.role !== "ADMIN") {
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { userId: true },
      });

      if (!userRecord?.userId || userRecord.userId !== loan.member.userId) {
        return NextResponse.json(
          { error: "Forbidden - You can only repay your own loans" },
          { status: 403 }
        );
      }
    }

    if (loan.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Loan already completed" },
        { status: 400 }
      );
    }

    // Calculate expected week based on disbursal date
    const disbursedDate = loan.disbursedAt
      ? new Date(loan.disbursedAt)
      : new Date();
    const paymentDate = data.paymentDate
      ? new Date(data.paymentDate)
      : new Date();

    // Calculate weeks since disbursal
    const weeksSinceDisbursal = Math.floor(
      (paymentDate.getTime() - disbursedDate.getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    );

    // Expected week = weeks since disbursal + 1 (week 1 starts immediately)
    const expectedWeek = weeksSinceDisbursal + 1;

    // Calculate missed weeks (if current week is behind expected week)
    const missedWeeks = Math.max(0, expectedWeek - loan.currentWeek - 1);

    // Auto-detect if payment is late
    const isLate = missedWeeks > 0 || data.isLate;
    const overdueWeeks =
      data.overdueWeeks > 0 ? data.overdueWeeks : missedWeeks;

    // Calculate weekly payment amount based on loan
    // Weekly principal = total principal / total weeks
    const weeklyPrincipal = loan.principal / loan.weeks;

    // Weekly interest = interest rate % of remaining balance
    // For missed weeks, interest accumulates on the remaining balance
    const weeklyInterest = (loan.remaining * loan.interestRate) / 100;

    // If there are missed weeks, calculate accumulated interest for those weeks
    let accumulatedInterest = 0;
    let accumulatedPenalty = 0;

    if (missedWeeks > 0) {
      // Calculate interest for each missed week
      let tempRemaining = loan.remaining;
      for (let i = 0; i < missedWeeks; i++) {
        const missedWeekInterest = (tempRemaining * loan.interestRate) / 100;
        accumulatedInterest += missedWeekInterest;
        // Penalty: 0.5% of remaining balance per missed week
        accumulatedPenalty += (tempRemaining * 0.5) / 100;
        // For next week's calculation, principal doesn't reduce (payment wasn't made)
        // But interest accumulates
      }
    }

    // Total weekly payment (current week + accumulated from missed weeks)
    const weeklyPayment = weeklyPrincipal + weeklyInterest;
    const totalPaymentThisWeek =
      weeklyPayment + accumulatedInterest + accumulatedPenalty;

    // Calculate new remaining balance
    const newRemaining = Math.max(0, loan.remaining - weeklyPrincipal);
    const newWeek = loan.currentWeek + 1 + missedWeeks; // Advance by missed weeks + 1

    // Calculate payment breakdown
    const payment = {
      principal: weeklyPrincipal,
      interest: weeklyInterest + accumulatedInterest,
      total: weeklyPayment + accumulatedInterest,
      newBalance: newRemaining,
    };

    // Calculate late penalty
    let latePenalty = accumulatedPenalty;
    if (
      data.isLate &&
      data.overdueWeeks > 0 &&
      data.overdueWeeks !== missedWeeks
    ) {
      // Manual override if different from calculated
      latePenalty = (loan.remaining * 0.5 * data.overdueWeeks) / 100;
    }

    // Total payment includes: weekly payment + accumulated interest + late penalty
    const totalPayment = payment.total + latePenalty;

    // Update loan
    const updatedLoan = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        remaining: payment.newBalance,
        currentWeek: newWeek,
        totalInterest: loan.totalInterest + payment.interest,
        totalPrincipalPaid: loan.totalPrincipalPaid + payment.principal,
        status: payment.newBalance <= 0 ? "COMPLETED" : "ACTIVE",
        completedAt: payment.newBalance <= 0 ? paymentDate : null,
        latePaymentPenalty: loan.latePaymentPenalty + latePenalty,
      },
    });

    // Create transaction
    const transaction = await prisma.loanTransaction.create({
      data: {
        loanId: loan.id,
        date: paymentDate,
        amount: payment.principal,
        interest: payment.interest, // Interest only (not including penalty)
        penalty: latePenalty, // Penalty recorded separately
        remaining: payment.newBalance,
        week: newWeek,
      },
    });

    // Update group fund if cycle exists
    type InterestDistributionWithMember = {
      id: string;
      loanId: string;
      groupMemberId: string;
      amount: number;
      distributionDate: Date;
      createdAt: Date;
      member: {
        id: string;
        userId: string;
        name: string;
        fatherName: string | null;
        address1: string | null;
        address2: string | null;
        accountNumber: string | null;
        phone: string | null;
        photo: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
      contributionPercentage: number;
    };
    let interestDistributions: InterestDistributionWithMember[] = [];
    if (loan.cycle?.groupFund) {
      const groupFund = loan.cycle.groupFund;
      const newInterestPool =
        groupFund.interestPool + payment.interest + latePenalty;
      const allocations = calculateGroupFundAllocation(newInterestPool);

      await prisma.groupFund.update({
        where: { id: groupFund.id },
        data: {
          interestPool: newInterestPool,
          emergencyReserve: allocations.emergencyReserve,
          insuranceFund: allocations.insuranceFund,
          adminFee: allocations.adminFee,
          totalFunds:
            groupFund.investmentPool +
            newInterestPool -
            allocations.emergencyReserve -
            allocations.insuranceFund -
            allocations.adminFee,
        },
      });

      // Distribute interest to group members when loan is completed
      if (updatedLoan.status === "COMPLETED" && loan.cycle?.group?.members) {
        const totalInterest = updatedLoan.totalInterest;
        const groupMembers = loan.cycle.group.members;

        // Calculate total contributions from all active members
        const totalContributions = groupMembers.reduce(
          (sum, gm) => sum + gm.totalContributed,
          0
        );

        // Distribute interest proportionally based on contributions
        if (totalContributions > 0 && totalInterest > 0) {
          const distributionDate = paymentDate;

          // Create interest distributions for each member
          const distributionPromises = groupMembers.map(async (groupMember) => {
            // Calculate member's share based on their contribution percentage
            const contributionPercentage =
              groupMember.totalContributed / totalContributions;
            const interestAmount = totalInterest * contributionPercentage;

            // Create interest distribution record
            const distribution = await prisma.interestDistribution.create({
              data: {
                loanId: loan.id,
                groupMemberId: groupMember.id,
                amount: interestAmount,
                distributionDate: distributionDate,
              },
            });

            // Update group member's total interest received
            await prisma.groupMember.update({
              where: { id: groupMember.id },
              data: {
                totalInterestReceived: {
                  increment: interestAmount,
                },
              },
            });

            return {
              ...distribution,
              member: groupMember.member,
              contributionPercentage: contributionPercentage * 100,
            };
          });

          interestDistributions = await Promise.all(distributionPromises);
        }
      }
    }

    return NextResponse.json(
      {
        loan: updatedLoan,
        transaction,
        payment: {
          principal: payment.principal,
          interest: payment.interest,
          latePenalty,
          total: totalPayment,
          newBalance: payment.newBalance,
          weeklyAmount: weeklyPayment, // Total amount to pay per week
          missedWeeks: missedWeeks, // Number of weeks missed
          expectedWeek: expectedWeek, // Expected week based on date
          isLate: isLate, // Whether payment is late
        },
        interestDistributions:
          interestDistributions.length > 0 ? interestDistributions : undefined,
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

    console.error("Error processing loan repayment:", error);
    return NextResponse.json(
      { error: "Failed to process repayment" },
      { status: 500 }
    );
  }
}
