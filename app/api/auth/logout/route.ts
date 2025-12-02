import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  
  // Delete the auth-token cookie from the store
  cookieStore.delete("auth-token");
  
  const response = NextResponse.json({ message: "Logged out successfully" });
  
  // Also set it in the response to ensure it's cleared on client side
  // Set with expired date and empty value to clear cookie
  response.cookies.set("auth-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0), // Expire immediately
    maxAge: 0, // No max age
    path: "/", // Same path as when it was set
  });
  
  // Delete cookie again to be sure
  response.cookies.delete("auth-token");
  
  return response;
}
