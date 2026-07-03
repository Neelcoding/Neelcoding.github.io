import SwiftUI

struct ContentView: View {
    @State private var quote = QuoteOfTheDay.quote()
    @State private var isShowingRefreshedDate = Date()

    private let midnightTimer = Timer.publish(every: 60, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color.accentColor.opacity(0.25), Color(.systemBackground)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 24) {
                    Spacer()

                    Image(systemName: "quote.opening")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)

                    Text(quote.text)
                        .font(.title2.weight(.medium))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)

                    Text("— \(quote.author)")
                        .font(.headline)
                        .foregroundStyle(.secondary)

                    Spacer()
                    Spacer()

                    Text(Date(), style: .date)
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                }
                .padding()
            }
            .navigationTitle("Daily Quote")
            .onAppear { refreshIfNeeded() }
            .onReceive(midnightTimer) { _ in refreshIfNeeded() }
        }
    }

    /// Re-evaluates today's quote. Cheap to call often since it's a pure
    /// function of the current date.
    private func refreshIfNeeded() {
        quote = QuoteOfTheDay.quote()
    }
}

#Preview {
    ContentView()
}
