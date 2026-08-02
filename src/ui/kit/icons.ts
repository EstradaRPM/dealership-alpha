import { createIconSet } from '@expo/vector-icons';
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json';
import materialFont from '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf';

/**
 * The kit's icon set renders MATERIAL icons, not Ionicons: Android's font
 * renderer silently rejects the Ionicons.ttf vendored by SDK 54's
 * @expo/vector-icons — the file downloads byte-perfect and expo-font
 * registers it without error, but every glyph paints as tofu (verified
 * on-device 2026-06-13; expo/vector-icons issue 351). MaterialIcons.ttf
 * through the identical pipeline renders fine, so the kit maps its
 * Ionicons-style names onto Material glyphs instead. The family name is
 * project-unique so nothing pre-registered by the Expo Go client can ever
 * shadow it.
 */
const IconSet = createIconSet(glyphMap, 'dealership-icons', materialFont);

/**
 * Call sites keep the Ionicons-style names they were written with; this map
 * is the single place those names resolve to Material glyphs. `satisfies`
 * makes a typo or a glyph missing from the vendored MaterialIcons set a
 * compile error.
 */
export const ICON_MAP = {
  'arrow-forward': 'arrow-forward',
  /** Paint gun / refinish — the Body Shop department tile (issue 346). */
  brush: 'brush',
  business: 'business',
  calendar: 'calendar-today',
  'car-sport': 'directions-car',
  cash: 'payments',
  checkmark: 'check',
  'chevron-forward': 'chevron-right',
  'chevron-down': 'expand-more',
  'chevron-up': 'expand-less',
  construct: 'build',
  /** Checkered flag — the day-action CTA's leading glyph (home-hub mockup). */
  'flag-checkered': 'sports-score',
  /** Two hands closing — the Sales department tile (issue 346). */
  handshake: 'handshake',
  home: 'home',
  'lock-closed': 'lock',
  menu: 'menu',
  /** Filed column / wire copy — the market-report + industry-wire empty states. */
  newspaper: 'article',
  people: 'people',
  remove: 'remove',
  star: 'star',
  storefront: 'storefront',
  /** Clock face — "nothing here yet, it arrives later" empty states. */
  time: 'schedule',
  'trending-down': 'trending-down',
  'trending-up': 'trending-up',
  wallet: 'account-balance-wallet',
} as const satisfies Record<string, keyof typeof glyphMap>;

export type IconName = keyof typeof ICON_MAP;

export { IconSet };

/** Font map for the root preload (`useFonts(iconFont)` in App.tsx). */
export const iconFont = IconSet.font;
