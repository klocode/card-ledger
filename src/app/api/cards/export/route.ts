import { buildExportCsv } from "@/lib/csv";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const cards = await db.card.findMany({
      include: {
        tags: true,
        priceEntries: { orderBy: { date: "desc" }, take: 1 },
      },
      orderBy: { name: "asc" },
    });

    const csv = buildExportCsv(cards);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="card-price-ledger-export.csv"',
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
