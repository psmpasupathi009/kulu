import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const createCollectionSchema = z.object({
  cycleId: z.string(),
  week: z.number().int().positive(),
  collectionDate: z.string().datetime(),
});

const recordPaymentSchema = z.object({
  collectionId: z.string(),
  memberId: z.string(),
  amount: z.number().positive().default(100),
  paymentMethod: z.string().optional(),
});

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

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycleId");

    if (!cycleId) {
      return NextResponse.json(
        { error: "cycleId is required" },
        { status: 400 }
      );
    }

    const collections = await prisma.weeklyCollection.findMany({
      where: { cycleId },
      include: {
        payments: {
          include: {
            member: true,
          },
        },
      },
      orderBy: { week: "asc" },
    });

    return NextResponse.json({ collections }, { status: 200 });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500 }
    );
  }
}

// Create a new weekly collection
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const data = createCollectionSchema.parse(body);

    // Check if collection already exists
    const existing = await prisma.weeklyCollection.findUnique({
      where: {
        cycleId_week: {
          cycleId: data.cycleId,
          week: data.week,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Collection for this week already exists" },
        { status: 400 }
      );
    }

    // Get cycle details with group and active members
    const cycle = await prisma.loanCycle.findUnique({
      where: { id: data.cycleId },
      include: {
        group: {
          include: {
            members: {
              where: { isActive: true },
              include: { member: true },
            },
          },
        },
      },
    });

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    if (!cycle.group) {
      return NextResponse.json(
        { error: "Group not found for this cycle" },
        { status: 404 }
      );
    }

    // Calculate active members for this week (members who joined before or during this week)
    const activeMembers = cycle.group.members.filter(
      (gm) => gm.joiningWeek <= data.week
    );
    const activeMemberCount = activeMembers.length;
    // Calculate expected amount based on each member's individual weekly amount
    const expectedAmount = activeMembers.reduce(
      (sum, gm) => sum + (gm.weeklyAmount || 100),
      0
    );

    const collection = await prisma.weeklyCollection.create({
      data: {
        cycleId: data.cycleId,
        groupId: cycle.groupId || null,
        week: data.week,
        collectionDate: new Date(data.collectionDate),
        totalCollected: 0,
        expectedAmount: expectedAmount,
        activeMemberCount: activeMemberCount,
        isCompleted: false,
      },
      include: {
        payments: true,
      },
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating collection:", error);
    return NextResponse.json(
      { error: "Failed to create collection" },
      { status: 500 }
    );
  }
}

// Record a payment for a collection
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const data = recordPaymentSchema.parse(body);

    // Check if payment already exists
    const existingPayment = await prisma.collectionPayment.findUnique({
      where: {
        collectionId_memberId: {
          collectionId: data.collectionId,
          memberId: data.memberId,
        },
      },
    });

    let payment;
    if (existingPayment) {
      // Update existing payment
      payment = await prisma.collectionPayment.update({
        where: { id: existingPayment.id },
        data: {
          amount: data.amount,
          paymentDate: new Date(),
          paymentMethod: data.paymentMethod,
          status: "PAID",
        },
      });

      // If updating existing payment, calculate the difference
      const amountDifference = data.amount - existingPayment.amount;
      if (amountDifference !== 0 && existingPayment.groupMemberId) {
        await prisma.groupMember.update({
          where: { id: existingPayment.groupMemberId },
          data: {
            totalContributed: {
              increment: amountDifference,
            },
          },
        });
      }
    } else {
      // Get group member for this payment
      const collectionForMember = await prisma.weeklyCollection.findUnique({
        where: { id: data.collectionId },
        include: {
          cycle: {
            include: {
              group: {
                include: {
                  members: {
                    where: {
                      memberId: data.memberId,
                      isActive: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const groupMember = collectionForMember?.cycle?.group?.members[0] || null;
      const groupMemberId = groupMember?.id || null;

      // Use member's weekly amount if not specified, or use provided amount
      const paymentAmount = data.amount || groupMember?.weeklyAmount || 100;

      // Create new payment
      payment = await prisma.collectionPayment.create({
        data: {
          collectionId: data.collectionId,
          memberId: data.memberId,
          groupMemberId: groupMemberId,
          amount: paymentAmount,
          paymentDate: new Date(),
          paymentMethod: data.paymentMethod,
          status: "PAID",
        },
      });

      // Update group member's total contributed when payment is created
      if (groupMemberId) {
        await prisma.groupMember.update({
          where: { id: groupMemberId },
          data: {
            totalContributed: {
              increment: paymentAmount,
            },
          },
        });
      }
    }

    // Get collection first to find group
    const collectionForGroup = await prisma.weeklyCollection.findUnique({
      where: { id: data.collectionId },
      include: {
        cycle: {
          include: {
            group: true,
          },
        },
      },
    });

    // Get group member for linking payment
    let groupMember = null;
    if (collectionForGroup?.cycle?.groupId) {
      groupMember = await prisma.groupMember.findFirst({
        where: {
          groupId: collectionForGroup.cycle.groupId,
          memberId: data.memberId,
          isActive: true,
        },
      });
    }

    // Update collection total
    const collection = await prisma.weeklyCollection.findUnique({
      where: { id: data.collectionId },
      include: {
        payments: {
          include: {
            member: true,
          },
        },
        cycle: {
          include: {
            group: {
              include: {
                members: {
                  where: { isActive: true },
                },
              },
            },
            groupFund: true,
          },
        },
      },
    });

    if (collection) {
      const totalCollected = collection.payments.reduce(
        (sum, p) => sum + (p.status === "PAID" ? p.amount : 0),
        0
      );

      // Update payment with groupMemberId if found (if not already set)
      if (groupMember && payment && !payment.groupMemberId) {
        await prisma.collectionPayment.update({
          where: { id: payment.id },
          data: { groupMemberId: groupMember.id },
        });
      }

      await prisma.weeklyCollection.update({
        where: { id: data.collectionId },
        data: {
          totalCollected: totalCollected,
          isCompleted: totalCollected >= (collection.expectedAmount || 0),
        },
      });

      // Add payment amount to group fund's investment pool
      // This represents the member's contribution to the group pool
      if (collection.cycle?.groupFund) {
        const paymentAmount = existingPayment
          ? data.amount - existingPayment.amount // Difference if updating
          : data.amount; // Full amount if new payment

        if (paymentAmount > 0) {
          await prisma.groupFund.update({
            where: { id: collection.cycle.groupFund.id },
            data: {
              investmentPool: {
                increment: paymentAmount,
              },
              totalFunds: {
                increment: paymentAmount,
              },
            },
          });
        }
      }
    }

    return NextResponse.json({ payment }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error recording payment:", error);
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }
}
