/** The only file that imports expo-navigation-bar. */
export interface NavBar {
  setHidden(hidden: boolean): void;
}

type NavigationBarModule = typeof import('expo-navigation-bar');

export const expoNavBar: NavBar = {
  setHidden(hidden) {
    try {
      // Loaded on use, so a dev client built before this module existed just keeps its bar.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-navigation-bar') as NavigationBarModule).NavigationBar.setHidden(hidden);
    } catch {
      // No native module in this build: nothing to hide.
    }
  },
};

/** Hidden unless the user switched it off. Absent means they never chose, so hidden. */
export const hideNavBarFromMeta = (value: string | null): boolean => value !== '0';

export const navBarMetaValue = (hidden: boolean): string => (hidden ? '1' : '0');

/**
 * Keeps the system navigation bar the way the user chose. The system brings the bar back after a
 * dialog, a picker or a trip to another app, so `reapply` runs each time the app becomes active.
 * Swiping up from the bottom edge still shows it for a moment, which is how a user reaches it.
 */
export function createNavBarController(nav: NavBar, save: (hidden: boolean) => Promise<void>) {
  let hidden = true;
  return {
    get hidden() {
      return hidden;
    },
    load(stored: string | null): boolean {
      hidden = hideNavBarFromMeta(stored);
      nav.setHidden(hidden);
      return hidden;
    },
    set(next: boolean): Promise<void> {
      hidden = next;
      nav.setHidden(next);
      return save(next);
    },
    reapply(): void {
      nav.setHidden(hidden);
    },
  };
}
