import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const repayROSCALoanSchema = z.object({
  loanId: z.string(),
  paymentDate: z.string(),
  isFullRepayment: z.boolean().default(false), // Full repayment with penalties
});

/**
 * ROSCA Repayment Calculation:
 * - Principal: ₹600
 * - Interest (2% × 10 weeks): ₹120
 * - Total: ₹720
 * - Penalty on loan (10%): ₹60 (₹10 per member)
 * - Penalty on interest (10%): ₹12 (₹2 per member)
 * - Total repayment: ₹792
 * - Per member share: ₹112 (₹100 savings + ₹10 loan penalty + ₹2 interest penalty)
 */
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
    const data = repayROSCALoanSchema.parse(body);

    // Get loan with member, cycle, and group info
    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: {
        member: true,
        cycle: {
          include: {
            group: {
              include: {
                members: {
                  where: { isActive: true },
                },
              },
            },
            groupFund: true,
            collections: {
              include: {
                payments: {
                  include: {
                    member: true,
                  },
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

    const group = loan.cycle?.group;
    if (!group) {
      return NextResponse.json(
        { error: "Group not found for this loan" },
        { status: 404 }
      );
    }

    // Get active members count
    const activeMembersCount = group.members?.length || 1;

    // ROSCA Calculations
    const principal = loan.principal; // ₹600
    const interestRate = loan.interestRate; // 2% per week
    const weeks = loan.weeks; // 10 weeks

    // Calculate total interest (2% × 10 weeks = 20% of principal)
    const totalInterest = (principal * interestRate * weeks) / 100; // ₹120

    // Calculate penalties
    const loanPenalty = (principal * group.penaltyLoanPercent) / 100; // ₹60 (10% of ₹600)
    const interestPenalty =
      (totalInterest * group.penaltyInterestPercent) / 100; // ₹12 (10% of ₹120)
    const totalPenalty = loanPenalty + interestPenalty; // ₹72

    // Total repayment amount
    const totalRepayment = principal + totalInterest + totalPenalty; // ₹792

    // Per member share breakdown
    const perMemberSavings = group.weeklyAmount || 100; // ₹100
    const perMemberLoanPenalty = loanPenalty / activeMembersCount; // ₹10
    const perMemberInterestPenalty = interestPenalty / activeMembersCount; // ₹2
    const perMemberTotal =
      perMemberSavings + perMemberLoanPenalty + perMemberInterestPenalty; // ₹112

    if (data.isFullRepayment) {
      // Full repayment: borrower pays ₹792, others pay ₹112 each
      const newRemaining = 0;
      const newWeek = weeks;

      // Update loan
      const updatedLoan = await prisma.loan.update({
        where: { id: loan.id },
        data: {
          remaining: newRemaining,
          currentWeek: newWeek,
          totalInterest: totalInterest,
          totalPrincipalPaid: principal,
          totalPenalty: totalPenalty,
          status: "COMPLETED",
          completedAt: new Date(data.paymentDate),
        },
      });

      // Create transaction for borrower's full payment
      const borrowerTransaction = await prisma.loanTransaction.create({
        data: {
          loanId: loan.id,
          date: new Date(data.paymentDate),
          amount: principal,
          interest: totalInterest,
          penalty: totalPenalty,
          remaining: newRemaining,
          week: newWeek,
        },
      });

      // Get all members in the cycle (for penalty distribution)
      const cycleMembers = await prisma.member.findMany({
        where: {
          id: {
            in:
              loan.cycle?.collections
                .flatMap((c) => c.payments.map((p) => p.memberId))
                .filter((id, index, arr) => arr.indexOf(id) === index) || [],
          },
        },
      });

      // Update group fund
      if (loan.cycle?.groupFund) {
        const groupFund = loan.cycle.groupFund;
        await prisma.groupFund.update({
          where: { id: groupFund.id },
          data: {
            investmentPool: {
              increment: principal, // Borrower repays principal
            },
            interestPool: {
              increment: totalInterest, // Interest goes to pool
            },
            totalFunds: {
              increment: principal + totalInterest, // Total repayment
            },
          },
        });
      }

      return NextResponse.json(
        {
          loan: updatedLoan,
          transaction: borrowerTransaction,
          repayment: {
            principal: principal,
            interest: totalInterest,
            penalty: totalPenalty,
            total: totalRepayment,
            perMemberShare: perMemberTotal,
            breakdown: {
              perMemberSavings: perMemberSavings,
              perMemberLoanPenalty: perMemberLoanPenalty,
              perMemberInterestPenalty: perMemberInterestPenalty,
            },
          },
          message: `Loan fully repaid. Borrower paid ₹${totalRepayment.toFixed(
            2
          )}. Each member owes ₹${perMemberTotal.toFixed(
            2
          )} (₹${perMemberSavings.toFixed(
            2
          )} savings + ₹${perMemberLoanPenalty.toFixed(
            2
          )} loan penalty + ₹${perMemberInterestPenalty.toFixed(
            2
          )} interest penalty).`,
        },
        { status: 200 }
      );
    } else {
      // Partial weekly repayment
      const weeklyPrincipal = principal / weeks; // ₹60 per week
      const weeklyInterest = (loan.remaining * interestRate) / 100; // 2% of remaining
      const weeklyPayment = weeklyPrincipal + weeklyInterest;
      const newRemaining = loan.remaining - weeklyPrincipal;
      const newWeek = loan.currentWeek + 1;

      // Update loan
      const updatedLoan = await prisma.loan.update({
        where: { id: loan.id },
        data: {
          remaining: newRemaining,
          currentWeek: newWeek,
          totalInterest: loan.totalInterest + weeklyInterest,
          totalPrincipalPaid: loan.totalPrincipalPaid + weeklyPrincipal,
          status: newRemaining <= 0 ? "COMPLETED" : "ACTIVE",
          completedAt: newRemaining <= 0 ? new Date() : null,
        },
      });

      // Create transaction
      const transaction = await prisma.loanTransaction.create({
        data: {
          loanId: loan.id,
          date: new Date(data.paymentDate),
          amount: weeklyPrincipal,
          interest: weeklyInterest,
          penalty: 0,
          remaining: newRemaining,
          week: newWeek,
        },
      });

      // Update group fund
      if (loan.cycle?.groupFund) {
        const groupFund = loan.cycle.groupFund;
        await prisma.groupFund.update({
          where: { id: groupFund.id },
          data: {
            investmentPool: {
              increment: weeklyPrincipal,
            },
            interestPool: {
              increment: weeklyInterest,
            },
            totalFunds: {
              increment: weeklyPayment,
            },
          },
        });
      }

      return NextResponse.json(
        {
          loan: updatedLoan,
          transaction,
          payment: {
            principal: weeklyPrincipal,
            interest: weeklyInterest,
            total: weeklyPayment,
            newBalance: newRemaining,
          },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error processing ROSCA loan repayment:", error);
    return NextResponse.json(
      { error: "Failed to process repayment" },
      { status: 500 }
    );
  }
}
