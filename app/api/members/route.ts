import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const createMemberSchema = z.object({
  userId: z.string(),
  name: z.string().min(1),
  email: z.string().email("Invalid email address"),
  fatherName: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  upiId: z.string().optional(),
  phone: z.string().optional(),
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

    const members = await prisma.member.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        savings: true,
        loans: true,
      },
    });

    return NextResponse.json({ members }, { status: 200 });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
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
    const data = createMemberSchema.parse(body);

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Check if userId is already used by another user
    const existingUserId = await prisma.user.findUnique({
      where: { userId: data.userId },
    });

    if (existingUserId) {
      return NextResponse.json(
        { error: "User ID already exists" },
        { status: 400 }
      );
    }

    // Create member and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the member
      const member = await tx.member.create({
        data: {
          userId: data.userId,
          name: data.name,
          fatherName: data.fatherName,
          address1: data.address1,
          address2: data.address2,
          accountNumber: data.accountNumber,
          ifscCode: data.ifscCode,
          upiId: data.upiId,
          phone: data.phone,
        },
      });

      // Create the user account for login
      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          phone: data.phone,
          userId: data.userId,
          role: "USER",
        },
      });

      return { member, user };
    });

    return NextResponse.json({ member: result.member }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating member:", error);
    return NextResponse.json(
      { error: "Failed to create member" },
      { status: 500 }
    );
  }
}
