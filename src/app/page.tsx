import { createClient } from '@/lib/supabase/server'
import { ChatSection } from "@/components/chat/ChatSection";

export default async function Home() {
  const supabase = await createClient()
  const fallback = { data: { user: null } } as const;
  const { data: { user } } = await Promise.race([
    supabase.auth.getUser().catch(() => fallback),
    new Promise<typeof fallback>((resolve) => setTimeout(() => resolve(fallback), 3000)),
  ]);
  return <ChatSection isLoggedIn={!!user} />;
}
