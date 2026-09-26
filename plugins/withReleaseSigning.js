const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes("signingConfigs.release")) {
      return config;
    }

    const signingStart = contents.indexOf("    signingConfigs {");
    const buildTypesStart = contents.indexOf("    buildTypes {", signingStart);

    if (signingStart === -1 || buildTypesStart === -1) {
      throw new Error("Unable to locate Android signing/buildTypes blocks.");
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

    contents =
      contents.slice(0, signingStart) +
      signingBlock +
      contents.slice(buildTypesStart);

    const releaseSigningMarker = "            signingConfig signingConfigs.debug";
    const releaseBlockStart = contents.lastIndexOf("        release {");
    const releaseSigningIndex = contents.indexOf(
      releaseSigningMarker,
      releaseBlockStart
    );

    if (releaseBlockStart === -1 || releaseSigningIndex === -1) {
      throw new Error("Unable to locate Android release signing configuration.");
    }

    contents =
      contents.slice(0, releaseSigningIndex) +
      "            signingConfig signingConfigs.release" +
      contents.slice(releaseSigningIndex + releaseSigningMarker.length);

    config.modResults.contents = contents;
    return config;
  });
};
