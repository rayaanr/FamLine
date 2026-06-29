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
import { ResetPasswordForm } from './_ResetPasswordForm'

export const metadata: Metadata = { title: 'Reset password - FamLine' }

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="flex flex-col items-center gap-2">
            <Image src="/Logo.svg" alt="FamLine" width={40} height={57} />
            <span className="font-heading text-2xl font-bold">FamLine</span>
          </Link>
          <CardTitle>Set new password</CardTitle>
          <CardDescription>Choose a strong password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
