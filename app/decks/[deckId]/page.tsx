import { DeckEditor } from "@/components/deck-editor"

interface PageProps {
  params: Promise<{
    deckId: string
  }>
}

export default async function DeckPage({ params }: PageProps) {
  const { deckId } = await params
  return <DeckEditor deckId={deckId} />
}