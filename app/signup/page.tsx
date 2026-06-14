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
import { SignupForm } from '@/components/auth/SignupForm'

export const metadata: Metadata = {
  title: 'Create account — FamLine',
}

export default function SignupPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="flex flex-col items-center gap-2">
            <Image src="/Logo.svg" alt="FamLine" width={40} height={57} />
            <span className="font-heading text-2xl font-bold">FamLine</span>
          </Link>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Start building your family tree</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
      </Card>
    </div>
  )
}
