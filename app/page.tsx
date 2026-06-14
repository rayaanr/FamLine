import Image from 'next/image'
import Link from 'next/link'
import { UserMenu } from '@/components/auth/UserMenu'

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex items-center justify-between p-4">
        <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
          <Image src="/Logo.svg" alt="" width={20} height={28} />
          FamLine
        </Link>
        <UserMenu />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <Image src="/Logo.svg" alt="FamLine" width={72} height={102} />
        <h1 className="text-4xl font-bold tracking-tight text-foreground">FamLine</h1>
        <p className="max-w-sm text-muted-foreground">
          Build and explore your family tree — add members, map relationships, and preserve your family history.
        </p>
        <Link
          href="/tree"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Open Family Trees
        </Link>
      </div>
    </div>
  )
}
