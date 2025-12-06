import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const addMemberSchema = z.object({
  memberId: z.string(),
  joiningDate: z.string().datetime(),
  joiningWeek: z.number().int().positive(),
  weeklyAmount: z.number().positive().optional(), // Optional: member's weekly contribution amount
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const members = await prisma.groupMember.findMany({
      where: {
        groupId: id,
        isActive: true, // Only return active members
      },
      include: {
        member: {
          select: {
            id: true,
            userId: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { joiningWeek: "asc" },
    });

    return NextResponse.json({ members }, { status: 200 });
  } catch (error) {
    console.error("Error fetching group members:", error);
    return NextResponse.json(
      { error: "Failed to fetch group members" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const data = addMemberSchema.parse(body);

    // Check if group exists
    const group = await prisma.group.findUnique({
      where: { id },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Check if member exists
    const member = await prisma.member.findUnique({
      where: { id: data.memberId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Check if member is already in group
    const existing = await prisma.groupMember.findUnique({
      where: {
        groupId_memberId: {
          groupId: id,
          memberId: data.memberId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Member is already in this group" },
        { status: 400 }
      );
    }

    // Use provided weeklyAmount or default from group or 100
    const memberWeeklyAmount = data.weeklyAmount || group.weeklyAmount || 100;

    // Get active cycles for this group to calculate backdated payments
    const activeCycles = await prisma.loanCycle.findMany({
      where: {
        groupId: id,
        isActive: true,
      },
      include: {
        collections: {
          orderBy: { week: "asc" },
        },
      },
    });

    // Create group member
    const groupMember = await prisma.groupMember.create({
      data: {
        groupId: id,
        memberId: data.memberId,
        joiningWeek: data.joiningWeek,
        joiningDate: new Date(data.joiningDate),
        weeklyAmount: memberWeeklyAmount,
        benefitAmount: 0, // Not used in simplified flow
      },
      include: {
        member: true,
      },
    });

    // Calculate and create backdated payments
    // New member needs to pay for all weeks from week 1 to their joining week
    const backdatedPayments: Array<{
      cycleId: string;
      week: number;
      amount: number;
    }> = [];

    // Create backdated payments in a transaction
    await prisma.$transaction(async (tx) => {
      for (const cycle of activeCycles) {
        // Member needs to pay for weeks 1 to (joiningWeek - 1)
        for (let week = 1; week < data.joiningWeek; week++) {
          // Find or create collection for this week
          let collection = await tx.weeklyCollection.findUnique({
            where: {
              cycleId_week: {
                cycleId: cycle.id,
                week: week,
              },
            },
          });

          if (!collection) {
            // Create collection if it doesn't exist
            collection = await tx.weeklyCollection.create({
              data: {
                cycleId: cycle.id,
                groupId: id,
                week: week,
                collectionDate: new Date(
                  new Date(cycle.startDate).getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000
                ),
                totalCollected: 0,
                expectedAmount: 0,
                activeMemberCount: 0,
                isCompleted: false,
              },
            });
          }

          // Check if payment already exists
          const existingPayment = await tx.collectionPayment.findUnique({
            where: {
              collectionId_memberId: {
                collectionId: collection.id,
                memberId: data.memberId,
              },
            },
          });

          if (!existingPayment) {
            // Create backdated payment
            await tx.collectionPayment.create({
              data: {
                collectionId: collection.id,
                memberId: data.memberId,
                groupMemberId: groupMember.id,
                amount: memberWeeklyAmount,
                paymentDate: new Date(data.joiningDate),
                paymentMethod: "CASH", // Default for backdated payments
                status: "PAID",
              },
            });

            // Update collection totals
            await tx.weeklyCollection.update({
              where: { id: collection.id },
              data: {
                totalCollected: { increment: memberWeeklyAmount },
                activeMemberCount: { increment: 1 },
              },
            });

            // Update group member's total contributed
            await tx.groupMember.update({
              where: { id: groupMember.id },
              data: {
                totalContributed: { increment: memberWeeklyAmount },
              },
            });

            // Create savings transaction for this payment
            let savings = await tx.savings.findFirst({
              where: { memberId: data.memberId },
            });

            if (!savings) {
              savings = await tx.savings.create({
                data: {
                  memberId: data.memberId,
                  totalAmount: 0,
                },
              });
            }

            const newTotal = savings.totalAmount + memberWeeklyAmount;
            await tx.savingsTransaction.create({
              data: {
                savingsId: savings.id,
                date: new Date(data.joiningDate),
                amount: memberWeeklyAmount,
                total: newTotal,
              },
            });

            await tx.savings.update({
              where: { id: savings.id },
              data: { totalAmount: newTotal },
            });

            backdatedPayments.push({
              cycleId: cycle.id,
              week: week,
              amount: memberWeeklyAmount,
            });
          }
        }
      }
    });

    return NextResponse.json(
      {
        groupMember,
        backdatedPayments: backdatedPayments.length > 0 ? backdatedPayments : undefined,
        message:
          backdatedPayments.length > 0
            ? `Member added successfully. ${backdatedPayments.length} backdated payment(s) created for weeks before joining.`
            : "Member added successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error adding member to group:", error);
    return NextResponse.json(
      { error: "Failed to add member to group" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required" },
        { status: 400 }
      );
    }

    // Deactivate instead of delete to preserve history
    const groupMember = await prisma.groupMember.updateMany({
      where: {
        groupId: id,
        memberId: memberId,
      },
      data: {
        isActive: false,
      },
    });

    if (groupMember.count === 0) {
      return NextResponse.json(
        { error: "Member not found in group" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Member removed from group" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error removing member from group:", error);
    return NextResponse.json(
      { error: "Failed to remove member from group" },
      { status: 500 }
    );
  }
}
