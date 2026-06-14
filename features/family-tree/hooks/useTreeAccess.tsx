"use client";

import { createContext, useContext } from "react";
import { canEditTree, canManageTree, type TreeRole } from "@/lib/permissions";

interface TreeAccess {
  /** The current user's role on the active tree. */
  role: TreeRole;
  /** Editor or above - may add/edit/delete people and relationships. */
  canEdit: boolean;
  /** Owner - may rename/delete the tree and manage its members. */
  canManage: boolean;
}

const TreeAccessContext = createContext<TreeAccess>({
  role: "member",
  canEdit: false,
  canManage: false,
});

export function TreeAccessProvider({
  role,
  children,
}: {
  role: TreeRole;
  children: React.ReactNode;
}) {
  const value: TreeAccess = {
    role,
    canEdit: canEditTree(role),
    canManage: canManageTree(role),
  };
  return (
    <TreeAccessContext.Provider value={value}>
      {children}
    </TreeAccessContext.Provider>
  );
}

export const useTreeAccess = () => useContext(TreeAccessContext);
