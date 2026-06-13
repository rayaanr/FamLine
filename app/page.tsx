import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background p-8 text-center">
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
  )
}
