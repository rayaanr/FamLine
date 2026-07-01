import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { TreeGallery } from "@/features/family-tree";
import { UserMenu } from "@/components/auth/UserMenu";
import { requireAuth } from "@/lib/auth-server";
import { isSuperAdmin } from "@/lib/permissions";
import { listAccessibleTrees } from "@/lib/tree-access";

export const metadata: Metadata = {
  title: "FamLine - Your Family Trees",
};

export default async function TreePage() {
  const session = await requireAuth();
  const trees = await listAccessibleTrees();
  const superAdmin = isSuperAdmin(session.user.role);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-lg font-bold text-foreground"
        >
          <Image src="/Logo.svg" alt="" width={20} height={28} />
          FamLine
        </Link>
        <UserMenu />
      </header>
      <TreeGallery initialTrees={trees} canLoadDemo={superAdmin} />
    </div>
  );
}
