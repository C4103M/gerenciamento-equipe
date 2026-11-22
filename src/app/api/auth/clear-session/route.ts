import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
