import { createClient } from '@/lib/supabase/server'
import { ChatSection } from "@/components/chat/ChatSection";

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <ChatSection isLoggedIn={!!user} />;
}
