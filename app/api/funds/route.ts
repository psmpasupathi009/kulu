import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { z } from 'zod'

const addInvestmentSchema = z.object({
  cycleId: z.string(),
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

    const { searchParams } = new URL(request.url)
    const cycleId = searchParams.get('cycleId')

    if (cycleId) {
      const fund = await prisma.groupFund.findFirst({
        where: { cycleId },
        include: { cycle: true },
      })

      if (!fund) {
        return NextResponse.json(
          { error: 'Group fund not found for this cycle' },
          { status: 404 }
        )
      }

      return NextResponse.json({ fund }, { status: 200 })
    }

    // Get all funds
    const funds = await prisma.groupFund.findMany({
      include: { cycle: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ funds }, { status: 200 })
  } catch (error) {
    console.error('Error fetching group funds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch group funds' },
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
    const data = addInvestmentSchema.parse(body)

    // Get or create group fund for cycle
    let groupFund = await prisma.groupFund.findFirst({
      where: { cycleId: data.cycleId },
    })

    if (!groupFund) {
      groupFund = await prisma.groupFund.create({
        data: {
          cycleId: data.cycleId,
          investmentPool: 0,
          totalFunds: 0,
        },
      })
    }

    // Add to investment pool
    const newInvestmentPool = groupFund.investmentPool + data.amount
    const newTotalFunds = groupFund.totalFunds + data.amount

    const updatedFund = await prisma.groupFund.update({
      where: { id: groupFund.id },
      data: {
        investmentPool: newInvestmentPool,
        totalFunds: newTotalFunds,
      },
    })

    return NextResponse.json(
      {
        fund: updatedFund,
        message: 'Investment added to group pool',
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

    console.error('Error adding investment:', error)
    return NextResponse.json(
      { error: 'Failed to add investment' },
      { status: 500 }
    )
  }
}

