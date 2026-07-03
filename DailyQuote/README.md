# Daily Quote

A SwiftUI iOS app with a WidgetKit widget. Shows a new quote every day from a
built-in, offline list — no network access, no backend, no App Group needed.

## How the "once per day" logic works

`Shared/QuoteOfTheDay.swift` picks a quote using the calendar day number
(`Calendar.ordinality(of: .day, in: .era, for: date)`) modulo the number of
quotes in `Shared/QuoteData.swift`. Because it's a pure function of the
current date, the app and the widget always land on the same quote without
sharing any state.

The widget's `TimelineProvider` (`DailyQuoteWidget/DailyQuoteWidget.swift`)
produces a single timeline entry and schedules the next reload for the
following local midnight (`QuoteOfTheDay.nextMidnight(after:)`), so iOS
refreshes the widget once a day around midnight.

## Project layout

```
DailyQuote.xcodeproj/        Xcode project (2 targets)
DailyQuote/                  App target (SwiftUI)
DailyQuoteWidget/            Widget extension target (WidgetKit, small + medium)
Shared/                      Quote model + data + "quote of the day" logic,
                              compiled into both targets
```

## Opening in Xcode

1. Open `DailyQuote.xcodeproj` in Xcode 15+ (iOS 17 deployment target).
2. Select the `DailyQuote` scheme and a simulator/device, then Run.
3. To see the widget, long-press the Home Screen → `+` → search "Daily Quote"
   → add the small or medium widget.

## Before submitting to the App Store

- **Bundle identifiers**: both targets currently use placeholder IDs
  (`com.neelcoding.DailyQuote` and `com.neelcoding.DailyQuote.DailyQuoteWidget`).
  In each target's *Signing & Capabilities* tab, change these to an identifier
  under your own Apple Developer account/team, then let Xcode's "Automatically
  manage signing" create the provisioning profiles.
- **App icon**: `DailyQuote/Assets.xcassets/AppIcon.appiconset` is set up for
  the modern single-size (1024×1024) icon format but has no image yet. Drag
  your 1024×1024 PNG (no transparency, no rounded corners) onto the AppIcon
  slot in the asset catalog.
- **Quotes**: `Shared/QuoteData.swift` ships with 100 general
  motivational/public-domain-style quotes. Swap in your own list — the app
  and widget will automatically pick them up.
- **Display name / version**: edit `CFBundleDisplayName`,
  `CFBundleShortVersionString`, etc. in the two `Info.plist` files, or the
  `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` build settings.
