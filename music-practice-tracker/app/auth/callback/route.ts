import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = supaServer();
    
    try {
      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Auth callback error:', error);
        return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
      }

      if (data.session) {
        // Successfully authenticated, redirect to dashboard
        return NextResponse.redirect(`${origin}/`);
      }
    } catch (error) {
      console.error('Auth callback exception:', error);
      return NextResponse.redirect(`${origin}/login?error=auth_callback_exception`);
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
