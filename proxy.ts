import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeToken } from "@/lib/auth-edge";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/auth/login",
    "/api/auth/login",
    "/api/auth/logout",
  ];
  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(route);
  });

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for auth token
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    // Redirect to login if not authenticated
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Decode token (Edge-compatible, full verification happens in API routes)
  const user = decodeToken(token);

  if (!user) {
    // Clear invalid token
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth/login", request.url));

    response.cookies.delete("auth-token");
    return response;
  }

  // Check admin routes - pages that require admin access
  const adminPageRoutes = [
    "/dashbaord/settings",
    "/dashbaord/members/new",
    "/dashbaord/cycles/new",
    "/dashbaord/savings/new",
    "/dashbaord/groups/new",
  ];
  const isAdminPageRoute = adminPageRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check admin API routes - APIs that require admin access
  const adminApiRoutes = [
    "/api/admin",
    "/api/members", // POST, PUT, DELETE require admin (creates user accounts automatically)
    "/api/cycles", // POST requires admin
    "/api/savings", // POST requires admin
    "/api/loans", // POST, PUT require admin
    "/api/loans/disburse", // POST requires admin
    "/api/funds", // POST requires admin
    "/api/statements", // POST requires admin
    "/api/transactions", // POST requires admin
    "/api/events", // POST requires admin
  ];
  const isAdminApiRoute = adminApiRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Block admin pages for non-admin users
  if (isAdminPageRoute && user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashbaord", request.url));
  }

  // Block admin API routes for non-admin users (GET requests are allowed for viewing)
  // Note: Individual API routes will check admin access for POST/PUT/DELETE operations
  if (
    isAdminApiRoute &&
    user.role !== "ADMIN" &&
    !pathname.match(/\/api\/[^/]+\/\[id\]/)
  ) {
    // Allow GET requests to view data, but block write operations
    // The actual API route handlers will enforce admin access for POST/PUT/DELETE
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
