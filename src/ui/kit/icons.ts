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
  business: 'business',
  calendar: 'calendar-today',
  'car-sport': 'directions-car',
  cash: 'payments',
  'chevron-forward': 'chevron-right',
  construct: 'build',
  home: 'home',
  menu: 'menu',
  people: 'people',
  remove: 'remove',
  star: 'star',
  storefront: 'storefront',
  'trending-down': 'trending-down',
  'trending-up': 'trending-up',
  wallet: 'account-balance-wallet',
} as const satisfies Record<string, keyof typeof glyphMap>;

export type IconName = keyof typeof ICON_MAP;

export { IconSet };

/** Font map for the root preload (`useFonts(iconFont)` in App.tsx). */
export const iconFont = IconSet.font;
