import { NextRequest, NextResponse } from "next/server";

// ============================================================
// Auth API — verifies password and sets cookie
// ============================================================

const AUTH_COOKIE = "ironlog-auth";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.APP_PASSWORD || "nero";

    if (password === correctPassword) {
      const response = NextResponse.json({ ok: true });
      response.cookies.set(AUTH_COOKIE, "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });
      return response;
    }

    return NextResponse.json(
      { ok: false, error: "Incorrect password" },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
