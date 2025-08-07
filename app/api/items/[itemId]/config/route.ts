
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { ContentService } from "@/lib/actions/content";
import { VocabularyExerciseConfigSchema } from "@/lib/schemas";
import { z } from "zod";

export async function PUT(
  request: Request,
  { params }: { params: { itemId: string } }
) {
  try {
    const { teacherId } = getAuth();
    const { itemId } = params;

    const body = await request.json();
    // For now, we assume it's a vocab config. A more robust solution would
    // have a dispatcher to validate against the correct schema based on item type.
    const config = VocabularyExerciseConfigSchema.parse(body);

    const updatedItem = await ContentService.updateUnitItemConfig(
      itemId,
      teacherId,
      config
    );

    return NextResponse.json(updatedItem);
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
