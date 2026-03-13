import { NextResponse } from "next/server";
import { getRunSummaries } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const revalidate = 10;

export async function GET() {
  try {
    const summaries = await getRunSummaries();
    return NextResponse.json(summaries);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to list runs" },
      { status: 500 }
    );
  }
}
