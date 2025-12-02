import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { z } from 'zod'
import {
  calculateWeeklyPayment,
  calculateGroupFundAllocation,
} from '@/lib/utils'

const repayLoanSchema = z.object({
  loanId: z.string(),
  principalPayment: z.number().positive().default(100),
  paymentDate: z.string(),
  isLate: z.boolean().default(false),
  overdueWeeks: z.number().int().min(0).default(0),
})

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = repayLoanSchema.parse(body)

    // Get loan with member and cycle info
    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: {
        member: true,
        cycle: {
          include: { groupFund: true },
        },
      },
    })

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    if (loan.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Loan already completed' },
        { status: 400 }
      )
    }

    // Calculate payment using declining balance method
    const payment = calculateWeeklyPayment(
      loan.remaining,
      data.principalPayment,
      loan.interestRate
    )

    // Calculate late penalty if applicable
    let latePenalty = 0
    if (data.isLate && data.overdueWeeks > 0) {
      latePenalty = (loan.remaining * 0.5 * data.overdueWeeks) / 100
    }

    const totalPayment = payment.total + latePenalty
    const newRemaining = payment.newBalance
    const newWeek = loan.currentWeek + 1

    // Update loan
    const updatedLoan = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        remaining: newRemaining,
        currentWeek: newWeek,
        totalInterest: loan.totalInterest + payment.interest,
        totalPrincipalPaid: loan.totalPrincipalPaid + payment.principal,
        status: newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE',
        completedAt: newRemaining <= 0 ? new Date() : null,
        latePaymentPenalty: loan.latePaymentPenalty + latePenalty,
      },
    })

    // Create transaction
    const transaction = await prisma.loanTransaction.create({
      data: {
        loanId: loan.id,
        date: new Date(data.paymentDate),
        amount: payment.principal,
        interest: payment.interest + latePenalty,
        remaining: newRemaining,
        week: newWeek,
      },
    })

    // Update group fund if cycle exists
    if (loan.cycle?.groupFund) {
      const groupFund = loan.cycle.groupFund
      const newInterestPool = groupFund.interestPool + payment.interest + latePenalty
      const allocations = calculateGroupFundAllocation(newInterestPool)

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
      })
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
          newBalance: newRemaining,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error processing loan repayment:', error)
    return NextResponse.json(
      { error: 'Failed to process repayment' },
      { status: 500 }
    )
  }
}

