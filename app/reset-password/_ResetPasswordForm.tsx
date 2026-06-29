'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ['confirm'],
  })

type FormData = z.infer<typeof schema>

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  if (!token) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        This reset link is invalid.{' '}
        <Link href="/forgot-password" className="font-medium text-foreground hover:underline">
          Request a new one
        </Link>
        .
      </p>
    )
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    const { error } = await authClient.resetPassword({
      newPassword: data.password,
      token,
    })
    setSubmitting(false)

    if (error) {
      toast.error(error.message ?? 'Could not reset password. The link may have expired.')
      return
    }

    toast.success('Password updated — please sign in')
    router.push('/login')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          {...register('confirm')}
        />
        {errors.confirm && (
          <p className="text-sm text-destructive">{errors.confirm.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Updating…' : 'Set new password'}
      </Button>
    </form>
  )
}
