import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { getMeta, setMeta } from '@/data/meta';

import { useDb } from './DbProvider';
import { createNavBarController, expoNavBar, navBarMetaValue, type NavBar } from './navBar';

interface NavBarValue {
  /** Whether the system navigation bar is hidden. Starts true, before the saved choice is read. */
  hidden: boolean;
  setHidden: (next: boolean) => void;
}

const NavBarContext = createContext<NavBarValue | null>(null);

export function useNavBar(): NavBarValue {
  const value = useContext(NavBarContext);
  if (!value) throw new Error('useNavBar needs a NavBarProvider above it');
  return value;
}

/** Hides the system navigation bar unless the user turned that off in Settings. */
export function NavBarProvider({
  children,
  nav = expoNavBar,
}: {
  children: ReactNode;
  nav?: NavBar;
}) {
  const db = useDb();
  const [hidden, setHiddenState] = useState(true);
  const controller = useRef(
    createNavBarController(nav, (next) => setMeta(db, 'hide_nav_bar', navBarMetaValue(next))),
  );

  useEffect(() => {
    let live = true;
    const current = controller.current;
    getMeta(db, 'hide_nav_bar')
      .then((stored) => live && setHiddenState(current.load(stored)))
      .catch(() => current.reapply());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') current.reapply();
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, [db]);

  const setHidden = useCallback((next: boolean) => {
    setHiddenState(next);
    void controller.current.set(next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ hidden, setHidden }), [hidden, setHidden]);
  return <NavBarContext.Provider value={value}>{children}</NavBarContext.Provider>;
}
