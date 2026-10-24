import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { getImportState, subscribeImportState } from '@/backup/importStore';

// Every cached query is derived from SQLite, so a finished import invalidates all of them.
// Writers added later do the same through useQueryClient().invalidateQueries().
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } }),
  );

  useEffect(() => {
    let phase = getImportState().phase;
    return subscribeImportState(() => {
      const next = getImportState().phase;
      if (next === 'done' && phase !== 'done') void client.invalidateQueries();
      phase = next;
    });
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
