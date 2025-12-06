import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const updateAmountSchema = z.object({
  memberId: z.string(),
  weeklyAmount: z.number().positive(),
});

export async function PUT(
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
    const data = updateAmountSchema.parse(body);

    // Update group member's weekly amount
    const groupMember = await prisma.groupMember.updateMany({
      where: {
        groupId: id,
        memberId: data.memberId,
        isActive: true,
      },
      data: {
        weeklyAmount: data.weeklyAmount,
      },
    });

    if (groupMember.count === 0) {
      return NextResponse.json(
        { error: "Member not found in group" },
        { status: 404 }
      );
    }

    // Fetch updated member
    const updated = await prisma.groupMember.findUnique({
      where: {
        groupId_memberId: {
          groupId: id,
          memberId: data.memberId,
        },
      },
      include: {
        member: true,
      },
    });

    return NextResponse.json({ groupMember: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating member weekly amount:", error);
    return NextResponse.json(
      { error: "Failed to update member weekly amount" },
      { status: 500 }
    );
  }
}
