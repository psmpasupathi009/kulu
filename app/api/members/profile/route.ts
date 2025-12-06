import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
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

    // Get user's userId to find their member record
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { userId: true },
    });

    if (!fullUser?.userId) {
      return NextResponse.json(
        { error: "Member record not found for this user" },
        { status: 404 }
      );
    }

    // Get member record with all related data
    const member = await prisma.member.findUnique({
      where: { userId: fullUser.userId },
      include: {
        savings: {
          include: {
            transactions: {
              orderBy: { date: "desc" },
              take: 10, // Last 10 transactions
            },
          },
        },
        loans: {
          include: {
            cycle: {
              include: {
                group: {
                  include: {
                    members: {
                      where: { isActive: true },
                    },
                  },
                },
              },
            },
            transactions: {
              orderBy: { date: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        groupMembers: {
          where: { isActive: true },
          include: {
            group: true,
            collectionPayments: {
              include: {
                collection: {
                  include: {
                    cycle: true,
                  },
                },
              },
              orderBy: { paymentDate: "desc" },
            },
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Calculate summary statistics
    const totalSavings = member.savings.reduce(
      (sum, s) => sum + s.totalAmount,
      0
    );

    const activeLoans = member.loans.filter(
      (l) => l.status === "ACTIVE" || l.status === "PENDING"
    );
    const completedLoans = member.loans.filter((l) => l.status === "COMPLETED");

    const totalLoansReceived = member.loans.reduce(
      (sum, l) => sum + l.principal,
      0
    );
    const totalLoansRemaining = member.loans.reduce(
      (sum, l) => sum + (l.status === "ACTIVE" ? l.remaining : 0),
      0
    );

    // No interest in simplified flow
    const totalInterestReceived = 0;

    // Calculate total contributions across all groups
    const totalContributions = member.groupMembers.reduce(
      (sum, gm) => sum + gm.totalContributed,
      0
    );

    // Get user email
    const userEmail = await prisma.user.findUnique({
      where: { userId: fullUser.userId },
      select: { email: true },
    });

    // No interest distributions in simplified flow
    const allInterestDistributions: any[] = [];

    return NextResponse.json(
      {
        member: {
          id: member.id,
          userId: member.userId,
          name: member.name,
          email: userEmail?.email || null,
          phone: member.phone,
          address1: member.address1,
          address2: member.address2,
          accountNumber: member.accountNumber,
        },
        summary: {
          totalSavings,
          totalContributions,
          totalLoansReceived,
          totalLoansRemaining,
          totalInterestReceived,
          activeLoansCount: activeLoans.length,
          completedLoansCount: completedLoans.length,
          groupsCount: member.groupMembers.length,
        },
        savings: member.savings,
        loans: member.loans,
        groups: member.groupMembers.map((gm) => ({
          id: gm.id,
          group: {
            id: gm.group.id,
            name: gm.group.name,
          },
          joiningWeek: gm.joiningWeek,
          joiningDate: gm.joiningDate,
          weeklyAmount: gm.weeklyAmount,
          totalContributed: gm.totalContributed,
          totalReceived: gm.totalReceived,
          benefitAmount: gm.benefitAmount,
          collections: gm.collectionPayments,
        })),
        interestDistributions: allInterestDistributions,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching member profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch member profile" },
      { status: 500 }
    );
  }
}
