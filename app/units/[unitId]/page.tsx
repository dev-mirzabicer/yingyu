import { UnitEditor } from "@/components/unit-editor"

interface PageProps {
  params: Promise<{
    unitId: string
  }>
}

export default async function UnitPage({ params }: PageProps) {
  const { unitId } = await params
  return <UnitEditor unitId={unitId} />
}
