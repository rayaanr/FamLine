'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { GoogleIcon } from '@/components/auth/GoogleIcon'
import { Spinner } from '@/components/ui/spinner'

export function LoginForm() {
  const searchParams = useSearchParams()
  const [googleLoading, setGoogleLoading] = useState(false)

  const redirectTo = searchParams.get('redirect') ?? '/tree'

  const handleGoogle = async () => {
    setGoogleLoading(true)
    await signIn.social({ provider: 'google', callbackURL: redirectTo })
    // no setGoogleLoading(false) — page navigates away
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleGoogle}
      disabled={googleLoading}
    >
      {googleLoading ? <Spinner /> : <GoogleIcon />}
      {googleLoading ? 'Redirecting…' : 'Continue with Google'}
    </Button>
  )
}
