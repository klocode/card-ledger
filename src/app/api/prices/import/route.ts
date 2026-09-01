import { NextRequest } from "next/server";
import { z } from "zod";

import { logPrices } from "@/lib/actions/price-actions";
import { logPriceRowSchema } from "@/lib/validations/price";

const bodySchema = z.object({ rows: z.array(logPriceRowSchema).min(1) });

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const { rows } = bodySchema.parse(json);
    const result = await logPrices(rows);
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
