import { UnitBuilder } from "@/components/unit-builder";

interface UnitPageProps {
  params: {
    unitId: string;
  };
}

export default function UnitPage({ params }: UnitPageProps) {
  return (
    <div className="container mx-auto p-4">
      <UnitBuilder unitId={params.unitId} />
    </div>
  );
}
