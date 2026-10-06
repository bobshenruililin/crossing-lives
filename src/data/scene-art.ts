import type { OptionId } from '../domain/model';

/** Original table illustrations share one deliberate coordinate plane.
 * These are image anchors, not geographic coordinates or navigation evidence.
 */
export const tableObjects = {
  jun: { x: 46.5, y: 37.5 },
  menu: { x: 33.3, y: 85 },
  phone: { x: 60.1, y: 80.8 },
  wallet: { x: 74.7, y: 88.2 },
} as const;

export const tableScenes: Record<OptionId, { image: string; alt: string; width: number; height: number }> = {
  hk: {
    image: 'hong-kong-table.webp',
    alt: 'Jun, a fictional adult friend, seated across a wooden table under the Hong Kong scene’s striped awning, with a menu, phone and closed wallet in the foreground.',
    width: 1671,
    height: 941,
  },
  sz: {
    image: 'shenzhen-table.webp',
    alt: 'Jun, the same fictional adult friend, seated across a wooden table on the planted Shenzhen terrace, with a menu, phone and closed wallet in the foreground.',
    width: 1672,
    height: 941,
  },
};

/** One fictional shared-origin ending, never the destination city labelled home. */
export const homeScene = {
  image: 'hong-kong-home-arrival.webp',
  alt: 'A fictional Hong Kong-inspired entryway with keys in a ceramic dish and a dark phone beside a closed wooden door; blue-night apartment windows glow beyond a small window.',
  width: 1672,
  height: 941,
  focal: { x: 55, y: 50 },
  phone: { x: 64.2, y: 38.1 },
  keys: { x: 55.5, y: 35.2 },
} as const;
