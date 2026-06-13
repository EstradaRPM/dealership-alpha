import { createIconSet } from '@expo/vector-icons';
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';
import ioniconsFont from '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf';

/**
 * The kit's Ionicons set, registered under a font-family name that is NOT
 * `'ionicons'`. The Expo Go client binary pre-registers its own Ionicons font
 * under that name, so `expo-font`'s `isLoaded('ionicons')` reports true, the
 * ttf shipped with our pinned `@expo/vector-icons` is never loaded, and glyph
 * codepoints resolve against the client's (mismatched) font — painting tofu /
 * CJK fallback characters that no JS-side version pinning can fix
 * (expo/vector-icons issue 351). A unique family name forces the runtime to load
 * the project's own ttf, so the glyph map and the font file always come from
 * the same package version.
 */
export const Ionicons = createIconSet(glyphMap, 'dealership-ionicons', ioniconsFont);

/** Font map for the root preload (`useFonts(iconFont)` in App.tsx). */
export const iconFont = Ionicons.font;
