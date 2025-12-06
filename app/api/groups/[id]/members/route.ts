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

    // Calculate benefit amount based on joining week
    // Members who join earlier get more benefit (proportional to their contribution period)
    // Benefit will be recalculated dynamically when loans are disbursed
    // Initial benefit is set to 0, will be calculated based on actual contributions
    const benefitAmount = 0;

    const groupMember = await prisma.groupMember.create({
      data: {
        groupId: id,
        memberId: data.memberId,
        joiningWeek: data.joiningWeek,
        joiningDate: new Date(data.joiningDate),
        weeklyAmount: memberWeeklyAmount,
        benefitAmount: benefitAmount,
      },
      include: {
        member: true,
      },
    });

    return NextResponse.json({ groupMember }, { status: 201 });
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
