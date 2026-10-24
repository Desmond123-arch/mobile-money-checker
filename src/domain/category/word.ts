/** How keywords and names are stored: lowercase, trimmed, single spaces (the schema CHECK says the same). */
export const normaliseWord = (text: string): string =>
  text.toLowerCase().replace(/\s+/g, ' ').trim();

/** A category's pale background: its colour mixed 82% toward white. */
export function tintOf(color: string): string {
  const channel = (offset: number) => {
    const v = parseInt(color.slice(offset, offset + 2), 16);
    return Math.round(v + (255 - v) * 0.82)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`.toUpperCase();
}

export const isHexColor = (text: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(text);
