// Permissions no build may hold, in every profile. expo-audio's library manifest merges in
// MODIFY_AUDIO_SETTINGS, which playback does not need, and RECORD_AUDIO must never reach the app
// (it only arrives through the expo-audio config plugin, which is not used).
const ALWAYS_BLOCKED = [
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
];

// Release builds must not hold INTERNET. EAS sets EAS_BUILD_PROFILE on the build server; a local `expo start` or dev-client run never sets it, so Metro keeps its permission.
const STRIPPED_PROFILES = ['production', 'preview'];

module.exports = ({ config }) => {
  const strip =
    STRIPPED_PROFILES.includes(process.env.EAS_BUILD_PROFILE ?? '') ||
    process.env.APP_STRIP_INTERNET === '1';
  const blocked = new Set([...(config.android?.blockedPermissions ?? []), ...ALWAYS_BLOCKED]);
  if (strip) blocked.add('android.permission.INTERNET');
  return { ...config, android: { ...config.android, blockedPermissions: [...blocked] } };
};
