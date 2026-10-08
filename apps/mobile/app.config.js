// Keep native Google Maps credentials out of source control. Expo Go already includes
// Google Maps; standalone Android APK/AAB builds need a restricted build-time key.
module.exports = ({config}) => {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      androidKey
        ? ["react-native-maps", {androidGoogleMapsApiKey: androidKey}]
        : "react-native-maps",
    ],
  };
};
