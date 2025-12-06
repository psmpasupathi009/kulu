import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";
// Removed interest and penalty calculation imports

const repayLoanSchema = z.object({
  loanId: z.string(),
  paymentDate: z.string().optional(), // Optional, defaults to now
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(), // Payment method for repayment
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

    // Calculate weekly payment amount based on loan
    // Weekly principal = total principal / total weeks (no interest, no penalty)
    const weeklyPrincipal = loan.principal / loan.weeks;

    // No interest or penalty - only principal payments
    const weeklyInterest = 0;
    const accumulatedInterest = 0;
    const accumulatedPenalty = 0;
    const latePenalty = 0;

    // Total weekly payment (only principal)
    const weeklyPayment = weeklyPrincipal;
    const totalPaymentThisWeek = weeklyPayment;

    // Calculate new remaining balance
    const newRemaining = Math.max(0, loan.remaining - weeklyPrincipal);
    const newWeek = loan.currentWeek + 1; // Advance by 1 week

    // Calculate payment breakdown
    const payment = {
      principal: weeklyPrincipal,
      interest: 0, // No interest
      total: weeklyPayment, // Only principal
      newBalance: newRemaining,
    };

    // Total payment is only principal (no interest, no penalty)
    const totalPayment = payment.total;

    // Update loan
    const updatedLoan = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        remaining: payment.newBalance,
        currentWeek: newWeek,
        totalPrincipalPaid: loan.totalPrincipalPaid + payment.principal,
        status: payment.newBalance <= 0 ? "COMPLETED" : "ACTIVE",
        completedAt: payment.newBalance <= 0 ? paymentDate : null,
      },
    });

    // Create transaction
    const transaction = await prisma.loanTransaction.create({
      data: {
        loanId: loan.id,
        date: paymentDate,
        amount: payment.principal,
        remaining: payment.newBalance,
        week: newWeek,
        paymentMethod: data.paymentMethod || null,
      },
    });

    // Simple flow: When loan is completed, distribute collected amount as savings to all members
    if (updatedLoan.status === "COMPLETED") {
      const totalPrincipalCollected = updatedLoan.totalPrincipalPaid;
      
      // Get all active members (no groups - all members in one pool)
      const allMembers = await prisma.member.findMany({
        where: {
          // Get members who have contributed (have savings or collection payments)
          OR: [
            { savings: { some: {} } },
            { collectionPayments: { some: {} } },
          ],
        },
      });

      // If we have group context, use group members; otherwise use all members
      let membersToDistribute = allMembers;
      if (loan.cycle?.group?.members && loan.cycle.group.members.length > 0) {
        membersToDistribute = loan.cycle.group.members.map(gm => gm.member);
      }

      // Calculate total contributions from all members
      const totalContributions = await prisma.collectionPayment.aggregate({
        _sum: { amount: true },
        where: {
          memberId: { in: membersToDistribute.map(m => m.id) },
          status: "PAID",
        },
      });

      const totalContributed = totalContributions._sum.amount || 0;

      // Distribute principal proportionally based on contributions
      if (totalContributed > 0 && totalPrincipalCollected > 0) {
        // Create savings distributions for each member
        const distributionPromises = membersToDistribute.map(async (member) => {
          // Get member's total contributions
          const memberContributions = await prisma.collectionPayment.aggregate({
            _sum: { amount: true },
            where: {
              memberId: member.id,
              status: "PAID",
            },
          });

          const memberContributed = memberContributions._sum.amount || 0;
          const contributionPercentage = memberContributed / totalContributed;
          const savingsAmount = totalPrincipalCollected * contributionPercentage;

          if (savingsAmount > 0) {
            // Find or create savings record for member
            let savings = await prisma.savings.findFirst({
              where: { memberId: member.id },
            });

            if (!savings) {
              savings = await prisma.savings.create({
                data: {
                  memberId: member.id,
                  totalAmount: 0,
                },
              });
            }

            // Create savings transaction
            const newTotal = savings.totalAmount + savingsAmount;
            await prisma.savingsTransaction.create({
              data: {
                savingsId: savings.id,
                date: paymentDate,
                amount: savingsAmount,
                total: newTotal,
              },
            });

            // Update savings total
            await prisma.savings.update({
              where: { id: savings.id },
              data: {
                totalAmount: newTotal,
              },
            });
          }

          return {
            memberId: member.id,
            memberName: member.name,
            contributionPercentage: contributionPercentage * 100,
            savingsAmount,
          };
        });

        await Promise.all(distributionPromises);
      }

      // Update group fund if exists
      if (loan.cycle?.groupFund) {
        await prisma.groupFund.update({
          where: { id: loan.cycle.groupFund.id },
          data: {
            investmentPool: 0, // All distributed as savings
            totalFunds: 0, // All distributed
          },
        });
      }
    } else {
      // Loan not completed yet - add repayment to investment pool
      if (loan.cycle?.groupFund) {
        await prisma.groupFund.update({
          where: { id: loan.cycle.groupFund.id },
          data: {
            investmentPool: {
              increment: payment.principal,
            },
            totalFunds: {
              increment: payment.principal,
            },
          },
        });
      }
    }

    return NextResponse.json(
      {
        loan: updatedLoan,
        transaction,
        payment: {
          principal: payment.principal,
          total: totalPayment,
          newBalance: payment.newBalance,
          weeklyAmount: weeklyPayment, // Total amount to pay per week (only principal)
          paymentMethod: data.paymentMethod || null,
        },
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
