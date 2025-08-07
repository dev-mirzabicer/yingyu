
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { ContentService } from "@/lib/actions/content";
import { z } from "zod";

const reorderSchema = z.object({
  itemIds: z.array(z.string().uuid()),
});

export async function PUT(
  request: Request,
  { params }: { params: { unitId: string } }
) {
  try {
    const { teacherId } = getAuth();
    const { unitId } = params;

    const body = await request.json();
    const { itemIds } = reorderSchema.parse(body);

    await ContentService.reorderUnitItems(unitId, teacherId, itemIds);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    // Handle other errors
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
