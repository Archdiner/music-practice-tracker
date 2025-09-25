"use client";
import { supaBrowser } from "../../lib/supabaseBrowser";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Music4, Target } from "lucide-react";

function LoginContent() {
  console.log(
    "SB env:",
    "URL len:", (process.env.NEXT_PUBLIC_SUPABASE_URL || "").length,
    "KEY len:", (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").length
  );
  const supabase = supaBrowser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check for auth errors from callback
    const error = searchParams.get('error');
    if (error) {
      setAuthError('Authentication failed. Please try again.');
    }

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

  const customTheme = {
    default: {
      colors: {
        brand: '#f39c6b',
        brandAccent: '#e7854b',
        brandButtonText: 'white',
        defaultButtonBackground: '#fefcf8',
        defaultButtonBackgroundHover: '#f5e9da',
        defaultButtonBorder: '#f5e9da',
        defaultButtonText: '#1f2937',
        dividerBackground: '#f5e9da',
        inputBackground: 'rgba(255, 255, 255, 0.8)',
        inputBorder: '#f5e9da',
        inputBorderHover: '#f39c6b',
        inputBorderFocus: '#f39c6b',
        inputText: '#1f2937',
        inputLabelText: '#6b7280',
        inputPlaceholder: '#9ca3af',
        messageText: '#1f2937',
        messageTextDanger: '#d26a6a',
        anchorTextColor: '#f39c6b',
        anchorTextHoverColor: '#e7854b',
      },
      space: {
        spaceSmall: '4px',
        spaceMedium: '8px',
        spaceLarge: '16px',
        labelBottomMargin: '8px',
        anchorBottomMargin: '4px',
        emailInputSpacing: '4px',
        socialAuthSpacing: '4px',
        buttonPadding: '10px 15px',
        inputPadding: '10px 15px',
      },
      fontSizes: {
        baseBodySize: '14px',
        baseInputSize: '14px',
        baseLabelSize: '14px',
        baseButtonSize: '14px',
      },
      fonts: {
        bodyFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
        buttonFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
        inputFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
        labelFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
      },
      borderWidths: {
        buttonBorderWidth: '1px',
        inputBorderWidth: '1px',
      },
      radii: {
        borderRadiusButton: '12px',
        buttonBorderRadius: '12px',
        inputBorderRadius: '12px',
      },
    },
  };

  if (isRedirecting) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">Redirecting to dashboard...</div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-apricot/10 rounded-2xl">
              <Music4 className="h-8 w-8 text-apricot" />
            </div>
            <h1 className="text-4xl font-bold text-foreground treble-clef">Note Log</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            AI-powered music practice tracking
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Track your practice, set goals, and get personalized insights
          </p>
        </div>

        {/* Auth Card */}
        <div className="p-8 rounded-2xl border border-beige-300 bg-card shadow-soft">
          {authError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {authError}
            </div>
          )}
          <Auth 
            supabaseClient={supabase} 
            appearance={{ 
              theme: ThemeSupa,
              variables: customTheme
            }} 
            providers={["google"]}
            redirectTo={typeof window !== 'undefined' ? 
              (window.location.hostname === 'localhost' ? `${window.location.origin}/auth/callback` : 'https://note-log-lac.vercel.app/auth/callback') : 
              'https://note-log-lac.vercel.app/auth/callback'
            }
          />
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-1 gap-4 mt-8">
          <div className="flex items-center gap-3 p-4 bg-card rounded-xl border border-beige-300 shadow-soft">
            <Target className="h-5 w-5 text-apricot" />
            <div>
              <p className="text-sm font-medium text-foreground">Set Musical Goals</p>
              <p className="text-xs text-muted-foreground">Get AI-powered guidance toward your objectives</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-4 bg-card rounded-xl border border-beige-300 shadow-soft">
            <Music4 className="h-5 w-5 text-sage" />
            <div>
              <p className="text-sm font-medium text-foreground">Smart Practice Parsing</p>
              <p className="text-xs text-muted-foreground">Natural language practice logging with AI</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center bg-background">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
