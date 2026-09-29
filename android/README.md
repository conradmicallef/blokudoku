# Blokudoku (Android)

Native Kotlin + Jetpack Compose (Material3) clone of Blokudoku. Same rules, shapes and scoring as `../pwa/game.js`.
minSdk 24, no third-party dependencies (only AndroidX / Compose).

## Build
Requires JDK 17 and the Android SDK (API 34).

- Android Studio: File > Open the `android` folder, let Gradle sync, press Run.
- Command line: the Gradle wrapper jar is not committed. Generate it once with an installed Gradle (8.7+):

      gradle wrapper --gradle-version 8.7

  then `./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`).
  APK: `app/build/outputs/apk/debug/app-debug.apk`. Set `sdk.dir` in `local.properties` if the SDK is not auto-detected.

## Layout
- `GameModel.kt` - pure Kotlin rules/scoring/serialization (no Android imports)
- `MainActivity.kt` - Compose UI, drag and drop, persistence (SharedPreferences)
