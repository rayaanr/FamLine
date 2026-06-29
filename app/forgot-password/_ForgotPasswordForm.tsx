'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authClient } from '@/lib/auth-client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const schema = z.object({ email: z.email('Enter a valid email') })
type FormData = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    await authClient.requestPasswordReset({
      email: data.email,
      redirectTo: '/reset-password',
    })
    setSubmitting(false)
    setSent(true)
  }

  if (sent) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        If an account exists for that email, a reset link is on its way. Check
        your inbox.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  )
}
