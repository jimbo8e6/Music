"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import type { CommentNode } from "@/lib/queries";
import type { Entry } from "@/db/schema";

export interface UserAlbumData {
  loggedIn: boolean;
  currentUserId?: string | null;
  entry?: Entry | null;
  onWatchlist?: boolean;
  ownedFormats?: string[];
  entryComments?: CommentNode[];
}

interface ContextValue {
  data: UserAlbumData | null;
  refresh: () => void;
}

const UserAlbumContext = createContext<ContextValue>({ data: null, refresh: () => {} });

export function UserAlbumProvider({
  albumId,
  children,
}: {
  albumId: string;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<UserAlbumData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    fetch(`/api/albums/${albumId}/user-data`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ loggedIn: false }));
  }, [albumId, refreshKey]);

  return (
    <UserAlbumContext.Provider value={{ data, refresh }}>
      {children}
    </UserAlbumContext.Provider>
  );
}

export function useUserAlbumData() {
  return useContext(UserAlbumContext);
}
