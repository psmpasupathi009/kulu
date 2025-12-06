import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const updateCycleSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
  weeklyAmount: z.number().positive().optional(),
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
    const cycle = await prisma.loanCycle.findUnique({
      where: { id },
      include: {
        loans: {
          include: { member: true },
        },
        sequences: {
          include: { member: true },
          orderBy: { week: "asc" },
        },
        groupFund: true,
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

    return NextResponse.json({ cycle }, { status: 200 });
  } catch (error) {
    console.error("Error fetching cycle:", error);
    return NextResponse.json(
      { error: "Failed to fetch cycle" },
      { status: 500 }
    );
  }
}

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
    const data = updateCycleSchema.parse(body);

    const updateData: Prisma.LoanCycleUpdateInput = {};
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined)
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.weeklyAmount) updateData.weeklyAmount = data.weeklyAmount;

    const cycle = await prisma.loanCycle.update({
      where: { id },
      data: updateData,
      include: {
        loans: {
          include: { member: true },
        },
        sequences: {
          include: { member: true },
          orderBy: { week: "asc" },
        },
        groupFund: true,
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

    return NextResponse.json(
      { cycle, message: "Cycle updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating cycle:", error);
    return NextResponse.json(
      { error: "Failed to update cycle" },
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

    // Check if cycle has active loans
    const cycle = await prisma.loanCycle.findUnique({
      where: { id },
      include: {
        loans: {
          where: {
            status: {
              in: ["ACTIVE", "PENDING"],
            },
          },
        },
        groupFund: true,
      },
    });

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    if (cycle.loans.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete cycle with active or pending loans. Please complete or cancel all loans first.",
        },
        { status: 400 }
      );
    }

    // Delete cycle and related data in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete group fund if exists
      if (cycle.groupFund) {
        await tx.groupFund.delete({
          where: { cycleId: id },
        });
      }

      // Delete sequences
      await tx.loanSequence.deleteMany({
        where: { cycleId: id },
      });

      // Delete collections
      await tx.weeklyCollection.deleteMany({
        where: { cycleId: id },
      });

      // Delete completed loans (if any)
      await tx.loan.deleteMany({
        where: { cycleId: id },
      });

      // Delete the cycle
      await tx.loanCycle.delete({
        where: { id },
      });
    });

    return NextResponse.json(
      { message: "Cycle deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting cycle:", error);
    return NextResponse.json(
      { error: "Failed to delete cycle" },
      { status: 500 }
    );
  }
}
