// Release builds must not hold INTERNET. EAS sets EAS_BUILD_PROFILE on the build server; a local `expo start` or dev-client run never sets it, so Metro keeps its permission.
const STRIPPED_PROFILES = ['production', 'preview'];

module.exports = ({ config }) => {
  const strip =
    STRIPPED_PROFILES.includes(process.env.EAS_BUILD_PROFILE ?? '') ||
    process.env.APP_STRIP_INTERNET === '1';
  if (!strip) return config;
  const blocked = new Set(config.android?.blockedPermissions ?? []);
  blocked.add('android.permission.INTERNET');
  return { ...config, android: { ...config.android, blockedPermissions: [...blocked] } };
};
