module.exports = function (api) {
  api.cache(true);
  return {
    // `jsxImportSource: "nativewind"` used to route every JSX element in the app
    // through NativeWind's runtime. Its only consumer was the unused
    // `components/ui/primitives.tsx`, and it interfered with plain `style`
    // props on core components (the custom tab bar's layout was ignored).
    // Everything else in the app is StyleSheet-based, so the default runtime is
    // what we want.
    presets: ["babel-preset-expo"],
    plugins: [],
  };
};
