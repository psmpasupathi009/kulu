import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { z } from 'zod'

const createSavingsSchema = z.object({
  memberId: z.string(),
  amount: z.number().positive(),
  date: z.string(),
})

export async function GET(request: NextRequest) {
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

    const savings = await prisma.savings.findMany({
      include: {
        member: true,
        transactions: {
          orderBy: { date: 'desc' },
        },
      },
    })

    return NextResponse.json({ savings }, { status: 200 })
  } catch (error) {
    console.error('Error fetching savings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch savings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifyToken(token)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = createSavingsSchema.parse(body)

    // Find or create savings record
    let savings = await prisma.savings.findFirst({
      where: { memberId: data.memberId },
    })

    if (!savings) {
      savings = await prisma.savings.create({
        data: {
          memberId: data.memberId,
          totalAmount: 0,
        },
      })
    }

    // Create transaction
    const newTotal = savings.totalAmount + data.amount
    const transaction = await prisma.savingsTransaction.create({
      data: {
        savingsId: savings.id,
        date: new Date(data.date),
        amount: data.amount,
        total: newTotal,
      },
    })

    // Update total
    const updatedSavings = await prisma.savings.update({
      where: { id: savings.id },
      data: { totalAmount: newTotal },
    })

    // If this is a weekly contribution (₹100), add to active cycle's investment pool
    // This assumes weekly contributions go to the current active cycle
    if (data.amount === 100) {
      const activeCycle = await prisma.loanCycle.findFirst({
        where: { isActive: true },
        include: { groupFund: true },
      })

      if (activeCycle?.groupFund) {
        await prisma.groupFund.update({
          where: { id: activeCycle.groupFund.id },
          data: {
            investmentPool: {
              increment: data.amount,
            },
            totalFunds: {
              increment: data.amount,
            },
          },
        })
      }
    }

    return NextResponse.json(
      { transaction, savings: updatedSavings },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating savings transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create savings transaction' },
      { status: 500 }
    )
  }
}

