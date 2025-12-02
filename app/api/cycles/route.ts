import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { calculateLoanAmount } from '@/lib/utils'

const createCycleSchema = z.object({
  cycleNumber: z.number().int().positive(),
  startDate: z.string(),
  totalMembers: z.number().int().positive().default(10),
  weeklyAmount: z.number().positive().default(100),
  memberIds: z.array(z.string()).min(1), // Members participating in this cycle
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

    const cycles = await prisma.loanCycle.findMany({
      include: {
        loans: {
          include: { member: true },
        },
        sequences: {
          include: { member: true },
          orderBy: { week: 'asc' },
        },
        groupFund: true,
      },
      orderBy: { cycleNumber: 'desc' },
    })

    return NextResponse.json({ cycles }, { status: 200 })
  } catch (error) {
    console.error('Error fetching cycles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cycles' },
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
    const data = createCycleSchema.parse(body)

    // Check if cycle number already exists
    const existingCycle = await prisma.loanCycle.findUnique({
      where: { cycleNumber: data.cycleNumber },
    })

    if (existingCycle) {
      return NextResponse.json(
        { error: 'Cycle number already exists' },
        { status: 400 }
      )
    }

    // Calculate loan amount
    const loanAmount = calculateLoanAmount(data.totalMembers, data.weeklyAmount)

    // Create cycle with sequences
    const cycle = await prisma.loanCycle.create({
      data: {
        cycleNumber: data.cycleNumber,
        startDate: new Date(data.startDate),
        totalMembers: data.totalMembers,
        weeklyAmount: data.weeklyAmount,
        isActive: true,
        sequences: {
          create: data.memberIds.map((memberId, index) => ({
            memberId,
            week: index + 1,
            loanAmount,
            status: 'PENDING',
          })),
        },
        groupFund: {
          create: {
            investmentPool: 0,
            interestPool: 0,
            emergencyReserve: 0,
            insuranceFund: 0,
            adminFee: 0,
            totalFunds: 0,
          },
        },
      },
      include: {
        sequences: {
          include: { member: true },
          orderBy: { week: 'asc' },
        },
        groupFund: true,
      },
    })

    return NextResponse.json({ cycle }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating cycle:', error)
    return NextResponse.json(
      { error: 'Failed to create cycle' },
      { status: 500 }
    )
  }
}

