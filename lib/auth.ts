import prisma from "./prisma";
import jwt from "jsonwebtoken";
import { generateOTP } from "./utils";
import nodemailer from "nodemailer";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: "ADMIN" | "USER";
  userId?: string;
}

export async function generateToken(user: AuthUser): Promise<string> {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch {
    return null;
  }
}

export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  // Get Email credentials from environment
  // Remove quotes if present (common in .env files)
  const emailUser = process.env.EMAIL_USER?.replace(/^["']|["']$/g, "").trim();
  const emailPassword = process.env.EMAIL_PASS?.replace(
    /^["']|["']$/g,
    ""
  ).trim();
  const emailHost = (process.env.EMAIL_HOST || "smtp.gmail.com")
    .replace(/^["']|["']$/g, "")
    .trim();
  const emailPort = parseInt(
    (process.env.EMAIL_PORT || "587").replace(/^["']|["']$/g, "")
  );
  const emailFrom = (process.env.EMAIL_FROM || emailUser)
    ?.replace(/^["']|["']$/g, "")
    .trim();

  // Check if email credentials are configured
  if (
    !emailUser ||
    !emailPassword ||
    emailUser.length === 0 ||
    emailPassword.length === 0
  ) {
    // Debug: Log what we found (without exposing password)
    const hasUser = !!process.env.EMAIL_USER;
    const hasPassword = !!process.env.EMAIL_PASS;
    const userLength = process.env.EMAIL_USER?.length || 0;
    const passwordLength = process.env.EMAIL_PASS?.length || 0;

    throw new Error(
      `Email credentials are not configured properly. EMAIL_USER: ${
        hasUser ? `found (${userLength} chars)` : "missing"
      }, EMAIL_PASS: ${
        hasPassword ? `found (${passwordLength} chars)` : "missing"
      }. Please check your .env file and restart the server.`
    );
  }

  // Create nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    tls: {
      rejectUnauthorized: false,
    },
  });

  // Send email directly
  const mailOptions = {
    from: emailFrom || emailUser,
    to: email,
    subject: "Your OTP Code - PAARI SHG",
    text: `Your OTP code is: ${otp}. This code will expire in 10 minutes.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">PAARI SHG Login</h1>
          </div>
          <div style="padding: 40px 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0; font-size: 20px;">Your OTP Code</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Your one-time passcode is:</p>
            <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
              <p style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 12px; margin: 0; font-family: 'Courier New', monospace;">${otp}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
              ⏰ This code will expire in <strong>10 minutes</strong>.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you didn't request this code, please ignore this email or contact support if you have concerns.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (sendError: any) {
    let errorMessage = "Failed to send email. ";
    if (sendError.code === "EAUTH") {
      errorMessage += "Authentication failed. Check EMAIL_USER and EMAIL_PASS.";
    } else if (sendError.code === "ECONNECTION") {
      errorMessage += `Connection failed. Check EMAIL_HOST and EMAIL_PORT.`;
    } else if (sendError.code === "ETIMEDOUT") {
      errorMessage += "Connection timeout. Check network settings.";
    } else {
      errorMessage += sendError.message || "Unknown error.";
    }
    throw new Error(errorMessage);
  }
}

/**
 * Retry database operation with exponential backoff
 */
async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on non-connection errors
      if (
        error.code !== "P2010" &&
        error.code !== "P1001" &&
        !error.message?.includes("Server selection timeout")
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

export async function verifyOTP(
  email: string,
  otp: string
): Promise<AuthUser | null> {
  const user = await retryDatabaseOperation(() =>
    prisma.user.findUnique({
      where: { email },
    })
  );

  if (!user || !user.otp || !user.otpExpires) {
    return null;
  }

  if (user.otp !== otp) {
    return null;
  }

  if (new Date() > user.otpExpires) {
    return null;
  }

  // Check if email matches ADMIN_EMAIL from env (in case it changed)
  const adminEmail = process.env.ADMIN_EMAIL;
  const isAdmin =
    adminEmail &&
    email.toLowerCase().trim() === adminEmail.toLowerCase().trim();
  const finalRole = isAdmin ? "ADMIN" : user.role;

  // Clear OTP after successful verification and update role if needed
  await prisma.user.update({
    where: { email },
    data: {
      otp: null,
      otpExpires: null,
      // Update role if email matches admin email
      role: isAdmin ? "ADMIN" : undefined,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    role: finalRole,
    userId: user.userId || undefined,
  };
}
