import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

/**
 * Get or create admin's member record
 * This allows admin to join groups as a member
 */
export async function GET(request: NextRequest) {
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

    // Get admin user from database
    const adminUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 }
      );
    }

    // Check if admin has a member record
    let member = null;
    if (adminUser.userId) {
      member = await prisma.member.findUnique({
        where: { userId: adminUser.userId },
      });
    }

    // If no member record exists, create one
    if (!member) {
      const userId = adminUser.userId || `ADMIN_${adminUser.id}`;

      // Check if userId is already taken
      const existingMember = await prisma.member.findUnique({
        where: { userId },
      });

      if (existingMember) {
        return NextResponse.json({ member: existingMember }, { status: 200 });
      }

      // Create member record for admin
      member = await prisma.member.create({
        data: {
          userId: userId,
          name: adminUser.name || "Admin",
          phone: adminUser.phone,
        },
      });

      // Update user with userId if not set
      if (!adminUser.userId) {
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { userId: userId },
        });
      }
    }

    return NextResponse.json({ member }, { status: 200 });
  } catch (error) {
    console.error("Error getting admin member:", error);
    return NextResponse.json(
      { error: "Failed to get admin member" },
      { status: 500 }
    );
  }
}

/**
 * Create or update admin's member record
 */
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
    const {
      userId,
      name,
      phone,
      fatherName,
      address1,
      address2,
      accountNumber,
    } = body;

    // Get admin user from database
    const adminUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 }
      );
    }

    const memberUserId = userId || adminUser.userId || `ADMIN_${adminUser.id}`;

    // Check if member already exists
    let member = await prisma.member.findUnique({
      where: { userId: memberUserId },
    });

    if (member) {
      // Update existing member
      member = await prisma.member.update({
        where: { id: member.id },
        data: {
          name: name || member.name,
          phone: phone || member.phone,
          fatherName: fatherName || member.fatherName,
          address1: address1 || member.address1,
          address2: address2 || member.address2,
          accountNumber: accountNumber || member.accountNumber,
        },
      });
    } else {
      // Create new member record
      member = await prisma.member.create({
        data: {
          userId: memberUserId,
          name: name || adminUser.name || "Admin",
          phone: phone || adminUser.phone,
          fatherName: fatherName,
          address1: address1,
          address2: address2,
          accountNumber: accountNumber,
        },
      });

      // Update user with userId if not set
      if (!adminUser.userId) {
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { userId: memberUserId },
        });
      }
    }

    return NextResponse.json({ member }, { status: 200 });
  } catch (error) {
    console.error("Error creating/updating admin member:", error);
    return NextResponse.json(
      { error: "Failed to create/update admin member" },
      { status: 500 }
    );
  }
}
