import type { Metadata } from "next";
import { TreeView } from "@/features/family-tree";
import { requireTreeViewWithGraph } from "@/lib/tree-access";

export const metadata: Metadata = {
  title: "FamLine - Family Tree",
};

export default async function TreeByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { graph, role } = await requireTreeViewWithGraph(id);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <TreeView tree={graph} role={role} />
    </div>
  );
}
