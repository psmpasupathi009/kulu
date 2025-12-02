import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { calculateWeeklyPayment } from '@/lib/utils'

const createLoanSchema = z.object({
  memberId: z.string(),
  principal: z.number().positive(),
  weeks: z.number().int().positive().default(10),
  interestRate: z.number().default(1.0),
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

    const loans = await prisma.loan.findMany({
      include: {
        member: true,
        transactions: {
          orderBy: { date: 'desc' },
        },
      },
    })

    return NextResponse.json({ loans }, { status: 200 })
  } catch (error) {
    console.error('Error fetching loans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch loans' },
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
    const data = createLoanSchema.parse(body)

    const loan = await prisma.loan.create({
      data: {
        memberId: data.memberId,
        principal: data.principal,
        remaining: data.principal,
        weeks: data.weeks,
        interestRate: data.interestRate,
        currentWeek: 0,
      },
    })

    return NextResponse.json({ loan }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating loan:', error)
    return NextResponse.json(
      { error: 'Failed to create loan' },
      { status: 500 }
    )
  }
}

