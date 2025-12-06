import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  weeklyAmount: z.number().positive().optional(), // Optional: default/suggested amount
  loanWeeks: z.number().int().positive().default(10),
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

    const groups = await prisma.group.findMany({
      include: {
        members: {
          where: { isActive: true },
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
        },
        cycles: {
          include: {
            loans: true,
            collections: {
              include: {
                payments: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ groups }, { status: 200 });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}

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
    const data = createGroupSchema.parse(body);

    // Find admin user by email
    const adminUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 }
      );
    }

    const group = await prisma.group.create({
      data: {
        name: data.name,
        adminId: adminUser.id,
        weeklyAmount: data.weeklyAmount,
        loanWeeks: data.loanWeeks,
      },
      include: {
        cycles: true,
        members: true,
      },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating group:", error);
    return NextResponse.json(
      { error: "Failed to create group" },
      { status: 500 }
    );
  }
}
