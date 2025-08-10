import { UnitBuilder } from "@/components/unit-builder";

export default async function UnitPage({
  params,
}: {
  params: { unitId: string };
}) {
  return (
    <div className="container mx-auto p-4">
      <UnitBuilder unitId={params.unitId} />
    </div>
  );
}
