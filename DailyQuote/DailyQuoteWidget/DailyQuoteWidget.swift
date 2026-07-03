import WidgetKit
import SwiftUI

struct QuoteEntry: TimelineEntry {
    let date: Date
    let quote: Quote
}

struct QuoteTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuoteEntry {
        QuoteEntry(date: Date(), quote: QuoteOfTheDay.all[0])
    }

    func getSnapshot(in context: Context, completion: @escaping (QuoteEntry) -> Void) {
        completion(QuoteEntry(date: Date(), quote: QuoteOfTheDay.quote()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuoteEntry>) -> Void) {
        let now = Date()
        let entry = QuoteEntry(date: now, quote: QuoteOfTheDay.quote(for: now))
        // Only one entry is needed: the quote doesn't change until the next
        // calendar day, so we just ask WidgetKit to reload right after
        // midnight rather than polling.
        let midnight = QuoteOfTheDay.nextMidnight(after: now)
        let timeline = Timeline(entries: [entry], policy: .after(midnight))
        completion(timeline)
    }
}

struct DailyQuoteWidgetEntryView: View {
    var entry: QuoteTimelineProvider.Entry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .systemMedium:
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "quote.opening")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 8) {
                    Text(entry.quote.text)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(4)
                    Text("— \(entry.quote.author)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding()
        default:
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "quote.opening")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(entry.quote.text)
                    .font(.caption.weight(.semibold))
                    .lineLimit(5)
                Spacer(minLength: 0)
                Text("— \(entry.quote.author)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}

struct DailyQuoteWidget: Widget {
    let kind: String = "DailyQuoteWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuoteTimelineProvider()) { entry in
            DailyQuoteWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) {
                    Color(.systemBackground)
                }
        }
        .configurationDisplayName("Daily Quote")
        .description("Shows an inspiring quote that changes every day.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#Preview(as: .systemSmall) {
    DailyQuoteWidget()
} timeline: {
    QuoteEntry(date: .now, quote: QuoteOfTheDay.all[0])
}

#Preview(as: .systemMedium) {
    DailyQuoteWidget()
} timeline: {
    QuoteEntry(date: .now, quote: QuoteOfTheDay.all[0])
}
