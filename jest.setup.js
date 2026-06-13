// react-native-reanimated v4 has no native worklets runtime under Jest (node),
// and its shipped `mock.js` re-imports the real index (which throws "Native part
// of Worklets doesn't seem to be initialized"). UI smoke tests don't exercise
// real UI-thread animation — they only need the hooks to be callable and the
// animated components to render — so stub the slice of the API the app uses.
jest.mock('react-native-reanimated', () => {
  const { View, Text, ScrollView, Image } = require('react-native');
  const passthrough = (component) => component;
  return {
    __esModule: true,
    default: {
      View,
      Text,
      ScrollView,
      Image,
      createAnimatedComponent: passthrough,
    },
    useSharedValue: (initial) => ({ value: initial }),
    // Static style in tests — no animation, just a renderable style object.
    useAnimatedStyle: () => ({}),
    withTiming: (toValue) => toValue,
    withSpring: (toValue) => toValue,
    Easing: new Proxy(
      {},
      {
        // Every Easing.* is an identity-ish easing fn; Easing.out(fn) etc. just
        // return a function so call sites compose without error.
        get: () => (t) => t,
      },
    ),
  };
});
