import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import {
  generateToken,
  verifyToken,
  sendOTPEmail,
  verifyOTP,
} from "@/lib/auth";
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
  } catch (err) {
    console.error("[LOGIN] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * Handle database connection errors
 */
function handleDatabaseError(error: unknown): NextResponse {
  console.error("[LOGIN] Database error:", error);
  const errorObj = error as { code?: string; message?: string };
  console.error("[LOGIN] Error code:", errorObj.code);
  console.error("[LOGIN] Error message:", errorObj.message);

  // Check if DATABASE_URL is missing
  if (!process.env.DATABASE_URL) {
    console.error("[LOGIN] DATABASE_URL environment variable is not set!");
    return NextResponse.json(
      {
        error:
          "Database configuration error. DATABASE_URL is not set. Please configure it in Vercel environment variables.",
      },
      { status: 503 }
    );
  }

  // Check for connection errors
  if (
    errorObj.code === "P2010" ||
    errorObj.code === "P1001" ||
    errorObj.message?.includes("Server selection timeout") ||
    errorObj.message?.includes("connection") ||
    errorObj.message?.includes("ECONNREFUSED") ||
    errorObj.message?.includes("ENOTFOUND")
  ) {
    const isVercel = process.env.VERCEL === "1";
    const errorMessage = isVercel
      ? "Database connection failed. Please check: 1) DATABASE_URL is set in Vercel environment variables, 2) MongoDB Atlas Network Access allows all IPs (0.0.0.0/0), 3) Database credentials are correct."
      : "Database connection failed. Please check your MongoDB connection string and network connectivity. If using MongoDB Atlas, ensure your IP is whitelisted.";

    return NextResponse.json({ error: errorMessage }, { status: 503 });
  }

  // Check for authentication errors
  if (
    errorObj.code === "P1000" ||
    errorObj.message?.includes("authentication")
  ) {
    return NextResponse.json(
      {
        error:
          "Database authentication failed. Please check your MongoDB username and password in DATABASE_URL.",
      },
      { status: 503 }
    );
  }

  // Check for unique constraint errors
  if (errorObj.code === "P2002") {
    // User might already exist, try to continue
    return NextResponse.json(
      {
        error:
          "An account with this email already exists. Please try logging in again.",
      },
      { status: 409 }
    );
  }

  // Generic database error with more context
  const errorDetails =
    process.env.NODE_ENV === "development"
      ? ` (${errorObj.message || errorObj.code || "Unknown error"})`
      : "";

  return NextResponse.json(
    {
      error:
        "Database operation failed. Please try again later." + errorDetails,
      // In development, include more details
      ...(process.env.NODE_ENV === "development" && {
        debug: {
          code: errorObj.code,
          message: errorObj.message,
          hasDatabaseUrl: !!process.env.DATABASE_URL,
        },
      }),
    },
    { status: 500 }
  );
}

/**
 * Retry database operation with exponential backoff
 */
async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorObj = error as { code?: string; message?: string };

      // Don't retry on non-connection errors
      if (
        errorObj.code !== "P2010" &&
        errorObj.code !== "P1001" &&
        !errorObj.message?.includes("Server selection timeout")
      ) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Handle OTP request - generate and send OTP
 */
async function handleOTPRequest(email: string, isAdmin: boolean) {
  try {
    // If not admin, verify user exists in database
    if (!isAdmin) {
      const existingUser = await retryDatabaseOperation(() =>
        prisma.user.findUnique({
          where: { email },
        })
      );

      if (!existingUser) {
        return NextResponse.json(
          {
            error:
              "User not found. Only admin can create users. Please contact admin.",
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
    const existingUser = await retryDatabaseOperation(() =>
      prisma.user.findUnique({
        where: { email },
      })
    );

    if (existingUser) {
      // Update existing user
      await retryDatabaseOperation(() =>
        prisma.user.update({
          where: { email },
          data: {
            otp,
            otpExpires,
            // Only update role if admin (in case admin email changed)
            role: isAdmin ? "ADMIN" : existingUser.role,
          },
        })
      );
    } else {
      // Create new user (only for admin during first login)
      // Try to create without userId first (MongoDB allows multiple nulls for unique fields)
      try {
        await retryDatabaseOperation(() =>
          prisma.user.create({
            data: {
              email,
              otp,
              otpExpires,
              role: isAdmin ? "ADMIN" : "USER",
              // Don't set userId - MongoDB allows multiple null values for unique fields
            },
          })
        );
      } catch (createError) {
        const createErrorObj = createError as {
          code?: string;
          meta?: { target?: string[] };
        };
        // If unique constraint error on userId, generate a unique userId
        if (
          createErrorObj.code === "P2002" &&
          createErrorObj.meta?.target?.includes("userId")
        ) {
          const uniqueUserId = `USER_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 9)}`;
          try {
            await retryDatabaseOperation(() =>
              prisma.user.create({
                data: {
                  email,
                  otp,
                  otpExpires,
                  role: isAdmin ? "ADMIN" : "USER",
                  userId: uniqueUserId,
                },
              })
            );
          } catch (retryError) {
            return handleDatabaseError(retryError);
          }
        } else {
          return handleDatabaseError(createError);
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
        {
          error:
            emailError.message ||
            "Failed to send email. Please check your email configuration and try again.",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return handleDatabaseError(error);
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

  try {
    // If not admin, verify user exists
    if (!isAdmin) {
      const existingUser = await retryDatabaseOperation(() =>
        prisma.user.findUnique({
          where: { email },
        })
      );

      if (!existingUser) {
        return NextResponse.json(
          {
            error:
              "User not found. Only admin can create users. Please contact admin.",
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
  } catch (error: any) {
    return handleDatabaseError(error);
  }
}
