import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { z } from 'zod'

const createStatementSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  pdfUrl: z.string().url().optional(),
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

    const statements = await prisma.monthlyStatement.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return NextResponse.json({ statements }, { status: 200 })
  } catch (error) {
    console.error('Error fetching statements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statements' },
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
    const data = createStatementSchema.parse(body)

    const existing = await prisma.monthlyStatement.findFirst({
      where: {
        month: data.month,
        year: data.year,
      },
    })

    const statement = existing
      ? await prisma.monthlyStatement.update({
          where: { id: existing.id },
          data: {
            pdfUrl: data.pdfUrl,
          },
        })
      : await prisma.monthlyStatement.create({
          data: {
            month: data.month,
            year: data.year,
            pdfUrl: data.pdfUrl,
          },
        })
      update: {
        pdfUrl: data.pdfUrl,
      },
      create: {
        month: data.month,
        year: data.year,
        pdfUrl: data.pdfUrl,
      },
    })

    return NextResponse.json({ statement }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating statement:', error)
    return NextResponse.json(
      { error: 'Failed to create statement' },
      { status: 500 }
    )
  }
}

