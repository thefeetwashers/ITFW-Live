// GET /api/news — immigration news inside the chat.
//
// Returns the built-in news posts only (src/lib/immigrationNews.ts)
// — no live feed is connected, and the response says so honestly.
// Optional query: ?forms=I-485,DS-260 — the news items are matched
// against those case forms and matching items are flagged
// "This may affect your case". No news item is ever invented here,
// and no item is ever presented as live.
//
// Responses:
//   200 { items, flags, affectingYourCase, feedConnected, feedNote }
// Unknown form codes in ?forms= are ignored (never an error, never
// a match) — only the built-in items' own forms can match.
import { NextResponse } from "next/server";
import { newsForChat } from "@/lib/immigrationNews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const formsParam = params.get("forms") ?? "";
  const topicsParam = params.get("topics") ?? "";
  const forms = formsParam
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);
  const topics = topicsParam
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
  const news = newsForChat(forms, topics);
  return NextResponse.json({
    items: news.items,
    flags: news.flags,
    affectingYourCase: news.affectingYourCase,
    feedConnected: news.feedConnected,
    feedNote: news.feedNote,
  });
}
