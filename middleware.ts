import { NextRequest, NextResponse } from "next/server";
import { resolveStockSymbol } from "./lib/stockDirectory";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();

  if (url.pathname === "/api/stock") {
    const rawSymbol = url.searchParams.get("symbol");

    if (rawSymbol) {
      const resolvedSymbol = resolveStockSymbol(rawSymbol);
      url.searchParams.set("symbol", resolvedSymbol);
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/stock"],
};