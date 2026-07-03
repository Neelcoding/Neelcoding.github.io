import Foundation

enum QuoteOfTheDay {
    static let all: [Quote] = QuoteData.quotes

    /// Deterministic pick based on the calendar day, so the app and the
    /// widget always agree on "today's" quote without needing to share
    /// any state (App Group, UserDefaults, etc.).
    static func quote(for date: Date = Date(), calendar: Calendar = .current) -> Quote {
        let dayNumber = calendar.ordinality(of: .day, in: .era, for: date) ?? 0
        let index = dayNumber % all.count
        return all[index]
    }

    /// The next local midnight after `date`, used to schedule the widget's
    /// timeline reload.
    static func nextMidnight(after date: Date = Date(), calendar: Calendar = .current) -> Date {
        let startOfToday = calendar.startOfDay(for: date)
        return calendar.date(byAdding: .day, value: 1, to: startOfToday) ?? date.addingTimeInterval(86_400)
    }
}
