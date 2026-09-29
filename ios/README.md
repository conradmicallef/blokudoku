# Blokudoku (iOS)

Native SwiftUI clone of the PWA in `../pwa`. iOS 16+, no third-party dependencies.

## Build

1. On a Mac with Xcode 15+, install XcodeGen: `brew install xcodegen`
2. `cd ios && xcodegen generate`
3. `open Blokudoku.xcodeproj`, choose a simulator or device, set your signing team, Run.
4. Tests: Cmd+U (logic tests in `BlokudokuTests/`).

Change `bundleIdPrefix` / `PRODUCT_BUNDLE_IDENTIFIER` in `project.yml` as needed. For a real icon, drop a
1024x1024 PNG into `Blokudoku/Assets.xcassets/AppIcon.appiconset` and add a `"filename"` key to its Contents.json.

## Layout

- `Blokudoku/GameModel.swift` - rules, scoring, persistence (`ObservableObject`, no UI code)
- `Blokudoku/ContentView.swift` - board, tray, drag and drop, game-over overlay
- `Blokudoku/BlokudokuApp.swift` - app entry
