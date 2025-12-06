// Edge-compatible auth functions for middleware
// This file uses only Edge Runtime compatible APIs

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: "ADMIN" | "USER";
  userId?: string;
}

// Base64 URL decode helper for Edge Runtime
function base64UrlDecode(str: string): string {
  // Replace URL-safe characters
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  
  // Add padding if needed
  while (base64.length % 4) {
    base64 += "=";
  }
  
  // Decode using atob (available in Edge Runtime)
  try {
    return atob(base64);
  } catch {
    return "";
  }
}

// Simple JWT decoder for Edge Runtime (without verification)
// Full verification happens in API routes
export function decodeToken(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part) using Edge-compatible method
    const payload = parts[1];
    const decodedStr = base64UrlDecode(payload);
    if (!decodedStr) {
      return null;
    }

    const decoded = JSON.parse(decodedStr);

    // Check if token is expired
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
      userId: decoded.userId,
    };
  } catch {
    return null;
  }
}

