import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const savings = await prisma.savings.findUnique({
      where: { id: params.id },
      include: {
        member: true,
        transactions: {
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!savings) {
      return NextResponse.json({ error: 'Savings not found' }, { status: 404 })
    }

    return NextResponse.json({ savings }, { status: 200 })
  } catch (error) {
    console.error('Error fetching savings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch savings' },
      { status: 500 }
    )
  }
}

