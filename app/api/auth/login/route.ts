import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateToken, verifyToken, sendOTPEmail, verifyOTP } from "@/lib/auth";
import { generateOTP } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL as string;

/**
 * Check if email matches admin email
 */
function isAdminEmail(email: string): boolean {
  if (!ADMIN_EMAIL) return false;
  return email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
}

/**
 * GET /api/auth/login
 * Returns current login status (admin email kept server-side only)
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    
    let isLoggedIn = false;
    if (token) {
      try {
        const user = await verifyToken(token);
        isLoggedIn = !!user;
      } catch {
        isLoggedIn = false;
      }
    }
    
    return NextResponse.json({ isLoggedIn });
  } catch (error) {
    return NextResponse.json({ isLoggedIn: false });
  }
}

/**
 * POST /api/auth/login
 * Handles OTP request and validation
 */
export async function POST(req: NextRequest) {
  try {
    const { type, email, code } = await req.json();

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isAdmin = isAdminEmail(normalizedEmail);

    if (type === "request") {
      return await handleOTPRequest(normalizedEmail, isAdmin);
    }

    if (type === "validate") {
      return await handleOTPValidation(normalizedEmail, code, isAdmin);
    }

    return NextResponse.json(
      { error: "Invalid request type. Use 'request' or 'validate'." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[LOGIN] Error:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle OTP request - generate and send OTP
 */
async function handleOTPRequest(email: string, isAdmin: boolean) {
  // If not admin, verify user exists in database
  if (!isAdmin) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser) {
      return NextResponse.json(
        {
          error: "User not found. Only admin can create users. Please contact admin.",
        },
        { status: 403 }
      );
    }
  }

  // Generate OTP
  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Update or create user with OTP
  // First check if user exists to avoid unnecessary operations
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    // Update existing user
    await prisma.user.update({
      where: { email },
      data: {
        otp,
        otpExpires,
        // Only update role if admin (in case admin email changed)
        role: isAdmin ? "ADMIN" : existingUser.role,
      },
    });
  } else {
    // Create new user (only for admin during first login)
    // Try to create without userId first (MongoDB allows multiple nulls for unique fields)
    try {
      await prisma.user.create({
        data: {
          email,
          otp,
          otpExpires,
          role: isAdmin ? "ADMIN" : "USER",
          // Don't set userId - MongoDB allows multiple null values for unique fields
        },
      });
    } catch (createError: any) {
      // If unique constraint error on userId, generate a unique userId
      if (createError.code === "P2002" && createError.meta?.target?.includes("userId")) {
        const uniqueUserId = `USER_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        try {
          await prisma.user.create({
            data: {
              email,
              otp,
              otpExpires,
              role: isAdmin ? "ADMIN" : "USER",
              userId: uniqueUserId,
            },
          });
        } catch (retryError: any) {
          console.error("[LOGIN] Failed to create user after retry:", retryError);
          return NextResponse.json(
            { error: "Failed to process request. Please try again." },
            { status: 500 }
          );
        }
      } else {
        // Other database errors
        console.error("[LOGIN] Database error:", createError);
        return NextResponse.json(
          { error: "Failed to process request. Please try again." },
          { status: 500 }
        );
      }
    }
  }

  // Send OTP via email (required - no fallback)
  try {
    await sendOTPEmail(email, otp);
    return NextResponse.json({ message: "Passcode sent to email." });
  } catch (emailError: any) {
    // Email sending failed - return error
    return NextResponse.json(
      { error: emailError.message || "Failed to send email. Please check your email configuration and try again." },
      { status: 500 }
    );
  }
}

/**
 * Handle OTP validation - verify code and create session
 */
async function handleOTPValidation(
  email: string,
  code: string,
  isAdmin: boolean
) {
  // Validate code
  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { error: "Passcode is required." },
      { status: 400 }
    );
  }

  // If not admin, verify user exists
  if (!isAdmin) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser) {
      return NextResponse.json(
        {
          error: "User not found. Only admin can create users. Please contact admin.",
        },
        { status: 403 }
      );
    }
  }

  // Verify OTP
  const user = await verifyOTP(email, code);

  if (!user) {
    return NextResponse.json(
      { error: "Invalid or expired passcode." },
      { status: 401 }
    );
  }

  // Generate JWT token
  const token = await generateToken(user);
  const cookieStore = await cookies();

  // Set auth cookie
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  // Return success response
  return NextResponse.json({
    message: "Login successful.",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}
