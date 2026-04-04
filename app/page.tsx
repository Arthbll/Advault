import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";

export default async function Home() {
  // If already authenticated, go straight to dashboard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return <LandingPage />;
}
