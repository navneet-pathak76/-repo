const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes("signingConfigs.release")) {
      return config;
    }

    const signingBlock = `
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file("\$rootDir/release.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
`;

    config.modResults.contents = contents.replace(
      /    signingConfigs \{[\\s\\S]*?    \}\n    buildTypes \{/,
      signingBlock + "    buildTypes {"
    );

    config.modResults.contents = config.modResults.contents.replace(
      /release \{\n            \/\/ Caution![\\s\\S]*?signingConfig signingConfigs\.debug/,
      `release {
            signingConfig signingConfigs.release`
    );

    return config;
  });
};
