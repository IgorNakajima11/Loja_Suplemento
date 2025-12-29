import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM = "http://127.0.0.1:3001/api/tts";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });

    const contentType = upstream.headers.get("Content-Type") || "audio/mpeg";
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    const msg = err?.message || "Proxy TTS falhou ao contatar o backend.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
