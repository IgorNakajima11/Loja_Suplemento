import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM = "http://127.0.0.1:3001/api/conversation";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      body: form,
    });

    const contentType = upstream.headers.get("Content-Type") || "application/octet-stream";
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    const msg = err?.message || "Proxy falhou ao contatar o backend.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
