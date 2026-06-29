import { Suspense } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ForgotPasswordForm } from './_ForgotPasswordForm'

export const metadata: Metadata = { title: 'Forgot password - FamLine' }

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="flex flex-col items-center gap-2">
            <Image src="/Logo.svg" alt="FamLine" width={40} height={57} />
            <span className="font-heading text-2xl font-bold">FamLine</span>
          </Link>
          <CardTitle>Forgot password?</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <ForgotPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
