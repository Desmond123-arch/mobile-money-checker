/** Smallest bottom inset used when the system reports less (some phones report 0 with three-button navigation). */
export const MIN_BOTTOM_INSET = 16;
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_GAP = 8;
const TAB_BAR_BREATHING = 16;

/** Extra scroll padding that keeps the last item above the floating tab bar, on top of the bottom inset. */
export const TAB_BAR_CLEARANCE = TAB_BAR_GAP + TAB_BAR_HEIGHT + TAB_BAR_BREATHING;

export function bottomInset(raw: number): number {
  return Math.max(raw, MIN_BOTTOM_INSET);
}

/** Distance from the screen's bottom edge to the bottom of the floating tab bar. */
export function tabBarBottom(raw: number): number {
  return bottomInset(raw) + TAB_BAR_GAP;
}
