"use client";
import { supaBrowser } from "../../lib/supabaseBrowser";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Login() {
  console.log(
    "SB env:",
    "URL len:", (process.env.NEXT_PUBLIC_SUPABASE_URL || "").length,
    "KEY len:", (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").length
  );
  const supabase = supaBrowser();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log("User already logged in, redirecting to dashboard");
        setIsRedirecting(true);
        router.push('/');
        return;
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event, session?.user?.id);
      if (event === 'SIGNED_IN' && session) {
        console.log("User signed in, redirecting to dashboard");
        setIsRedirecting(true);
        // Small delay to ensure session is properly set
        setTimeout(() => {
          router.push('/');
        }, 100);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase.auth, router]);

  if (isRedirecting) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">Redirecting to dashboard...</div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-6 rounded-2xl border border-beige-300 bg-card shadow-soft">
        <Auth 
          supabaseClient={supabase} 
          appearance={{ theme: ThemeSupa }} 
          providers={[]}
          redirectTo={typeof window !== 'undefined' ? window.location.origin : undefined}
        />
      </div>
    </main>
  );
}
