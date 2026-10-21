import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { openDatabase, type Db } from '@/data/db';
import { migrate } from '@/data/migrate';
import { MIGRATIONS } from '@/data/migrations';
import { seedDatabase } from '@/data/seed';

const DbContext = createContext<Db | null>(null);

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb needs a DbProvider above it');
  return db;
}

type State = { phase: 'opening' } | { phase: 'ready'; db: Db } | { phase: 'failed' };

// Renders nothing until the database is migrated and seeded, so no screen can query a missing table.
export function DbProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ phase: 'opening' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await openDatabase();
      await migrate(db, MIGRATIONS);
      await seedDatabase(db);
      if (!cancelled) setState({ phase: 'ready', db });
    })().catch(() => {
      if (!cancelled) setState({ phase: 'failed' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase === 'ready')
    return <DbContext.Provider value={state.db}>{children}</DbContext.Provider>;
  if (state.phase === 'failed') {
    void SplashScreen.hideAsync();
    return (
      <View testID="dbErrorScreen" className="flex-1 items-center justify-center bg-ground px-5">
        <Text className="font-inter text-body text-ink">
          We could not open the database on this phone.
        </Text>
      </View>
    );
  }
  return null;
}
