import {
  bottomInset,
  MIN_BOTTOM_INSET,
  TAB_BAR_CLEARANCE,
  TAB_BAR_HEIGHT,
  tabBarBottom,
} from '../insets';

describe('bottom insets', () => {
  it('floors a zero inset', () => {
    expect(bottomInset(0)).toBe(MIN_BOTTOM_INSET);
  });

  it('keeps a real inset (three-button bar, gesture pill)', () => {
    expect(bottomInset(48)).toBe(48);
    expect(bottomInset(24)).toBe(24);
  });

  it('lifts the tab bar above the system bar', () => {
    expect(tabBarBottom(48)).toBeGreaterThan(48);
    expect(tabBarBottom(0)).toBeGreaterThan(0);
  });

  it('reserves scroll space past the top of the tab bar for every inset', () => {
    for (const raw of [0, 16, 24, 48]) {
      expect(bottomInset(raw) + TAB_BAR_CLEARANCE).toBeGreaterThan(
        tabBarBottom(raw) + TAB_BAR_HEIGHT,
      );
    }
  });
});
