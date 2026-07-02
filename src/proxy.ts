import { NextRequest, NextResponse } from "next/server";

// ============================================================
// Middleware Password Gate
// Blocks all access unless the ironlog-auth cookie is set.
// If missing, returns a login page inline (no separate route).
// ============================================================

const AUTH_COOKIE = "ironlog-auth";
const COOKIE_MAX_AGE = "2592000"; // 30 days in seconds

export function proxy(request: NextRequest) {
  const authCookie = request.cookies.get(AUTH_COOKIE)?.value;

  // If already authenticated, let the request through
  if (authCookie === "authenticated") {
    return NextResponse.next();
  }

  // If this is the auth API request, let it through
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Not authenticated — return the login page inline
  const loginHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>IronLog — Login</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: #0a0a0a;
    color: #fafafa;
    display: flex;
    min-height: 100vh;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }
  .card {
    max-width: 360px;
    width: 100%;
    text-align: center;
  }
  .logo {
    width: 72px;
    height: 72px;
    margin: 0 auto 1.5rem;
    background: linear-gradient(135deg, #18181b, #09090b);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #27272a;
  }
  .logo svg { width: 40px; height: 40px; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; font-weight: 700; }
  p { color: #a1a1aa; font-size: 0.875rem; margin-bottom: 1.5rem; }
  form { display: flex; flex-direction: column; gap: 0.75rem; }
  input {
    background: #18181b;
    border: 1px solid #27272a;
    color: #fafafa;
    padding: 0.875rem 1rem;
    border-radius: 0.625rem;
    font-size: 1rem;
    text-align: center;
    outline: none;
    transition: border-color 0.2s;
  }
  input:focus { border-color: #52525b; }
  button {
    background: #fafafa;
    color: #0a0a0a;
    border: 0;
    padding: 0.875rem 1rem;
    border-radius: 0.625rem;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  button:active { opacity: 0.8; }
  .error {
    color: #ef4444;
    font-size: 0.8125rem;
    min-height: 1.2em;
  }
</style>
</head>
<body>
<div class="card">
<div class="logo">
<svg viewBox="0 0 24 24" fill="none" stroke="#fafafa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>
</svg>
</div>
<h1>IronLog</h1>
<p>Enter password to access your gym tracker</p>
<form id="loginForm">
<input type="password" id="password" placeholder="Password" autofocus />
<button type="submit">Unlock</button>
<p class="error" id="error"></p>
</form>
</div>
<script>
const form = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const errorEl = document.getElementById('error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = passwordInput.value;
  errorEl.textContent = '';

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.reload();
    } else {
      errorEl.textContent = 'Incorrect password';
      passwordInput.value = '';
      passwordInput.focus();
    }
  } catch (err) {
    errorEl.textContent = 'Connection error';
  }
});
</script>
</body>
</html>`;

  return new NextResponse(loginHtml, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|apple-touch-icon.png|manifest.webmanifest|sw.js|offline.html).*)"],
};
