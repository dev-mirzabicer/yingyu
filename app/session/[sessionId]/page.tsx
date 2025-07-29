import { LiveSession } from "@/components/live-session"

interface PageProps {
  params: Promise<{
    sessionId: string
  }>
}

export default async function SessionPage({ params }: PageProps) {
  const { sessionId } = await params
  return <LiveSession sessionId={sessionId} />
}