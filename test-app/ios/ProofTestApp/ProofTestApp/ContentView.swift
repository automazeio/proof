import SwiftUI

struct ContentView: View {
    @State private var message = "Hello, World!"
    @State private var tapCount = 0

    var body: some View {
        VStack(spacing: 24) {
            Text(message)
                .font(.largeTitle)
                .fontWeight(.bold)
                .accessibilityIdentifier("messageLabel")

            Text("Tapped \(tapCount) times")
                .font(.title2)
                .foregroundColor(.secondary)
                .accessibilityIdentifier("countLabel")

            Button(action: {
                tapCount += 1
                message = tapCount == 1 ? "You tapped!" : "Tapped \(tapCount)x!"
            }) {
                Text("Tap Me")
                    .font(.title2)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("tapButton")

            Button(action: {
                tapCount = 0
                message = "Hello, World!"
            }) {
                Text("Reset")
                    .font(.body)
            }
            .buttonStyle(.bordered)
            .accessibilityIdentifier("resetButton")
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
