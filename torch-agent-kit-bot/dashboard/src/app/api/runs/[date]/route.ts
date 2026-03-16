import { NextRequest, NextResponse } from "next/server";
import { loadRunArtifact } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const revalidate = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  try {
    const artifact = await loadRunArtifact(date);
    if (!artifact) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json(artifact);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to load run" },
      { status: 500 }
    );
  }
}
