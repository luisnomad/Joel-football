import { describe, expect, it } from 'vitest';
import { createHelpColumnLayout } from '../src/game/ui/helpLayout.js';

describe('help modal safe columns', () => {
  it('bounds each text lane before the next badge and inside the panel', () => {
    const layout = createHelpColumnLayout();
    const [left, right] = layout.columns;

    expect(left.textWidth).toBeGreaterThan(0);
    expect(right.textWidth).toBeGreaterThan(0);
    expect(left.textRight + layout.interColumnGap).toBe(
      right.badgeX - layout.badgeRadius,
    );
    expect(right.textRight).toBe(layout.panelRight - layout.outerPadding);

    for (const column of layout.columns) {
      expect(column.textX).toBeGreaterThan(layout.panelLeft);
      expect(column.textRight).toBeLessThan(layout.panelRight);
    }
  });

  it('keeps the same safety contract when the panel geometry changes', () => {
    const layout = createHelpColumnLayout({
      panelX: 500,
      panelWidth: 700,
      badgeCenters: [260, 580],
    });

    expect(layout.columns[0].textRight).toBe(531);
    expect(layout.columns[1].textRight).toBe(818);
    expect(layout.columns[0].textWidth).toBe(223);
    expect(layout.columns[1].textWidth).toBe(190);
  });
});
