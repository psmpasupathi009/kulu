import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

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
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      )
    }

    const foundUser = await prisma.user.findUnique({
      where: { userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        userId: true,
      },
    })

    if (!foundUser) {
      return NextResponse.json(
        { error: 'User not found', user: null },
        { status: 404 }
      )
    }

    return NextResponse.json({ user: foundUser }, { status: 200 })
  } catch (error) {
    console.error('Error fetching user by userId:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

