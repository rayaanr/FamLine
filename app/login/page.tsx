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
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign in — FamLine',
}

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="flex flex-col items-center gap-2">
            <Image src="/Logo.svg" alt="FamLine" width={40} height={57} />
            <span className="font-heading text-2xl font-bold">FamLine</span>
          </Link>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
