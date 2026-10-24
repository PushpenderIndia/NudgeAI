import { NextResponse, type NextRequest } from "next/server";
import { DEMO_KEY_COOKIE, newDemoKey, writeDemoCookies } from "@/lib/demo-cookies";

/** `?demo=1` on any page turns on demo mode for this browser, then drops the param. */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  if (url.searchParams.get("demo") !== "1" || request.method !== "GET") return NextResponse.next();
  url.searchParams.delete("demo");
  const res = NextResponse.redirect(url);
  writeDemoCookies(res.cookies, request.cookies.get(DEMO_KEY_COOKIE)?.value || newDemoKey());
  return res;
}

export const config = {
  matcher: [{ source: "/((?!api|_next/static|_next/image|favicon.ico).*)", has: [{ type: "query", key: "demo" }] }],
};
