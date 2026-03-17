import XCTest

/// Logs tap coordinates to a JSON file for post-processing by Proof.
/// Usage: call `element.proofTap()` instead of `element.tap()` in your XCUITest.
/// The log file is written to /tmp/proof-taps.json on the simulator.
final class ProofTapLogger {
    static let shared = ProofTapLogger()

    private var entries: [[String: Any]] = []
    private let filePath: String

    private init() {
        let home = ProcessInfo.processInfo.environment["HOME"] ?? NSTemporaryDirectory()
        filePath = (home as NSString).appendingPathComponent("proof-taps.json")
    }

    func log(element: XCUIElement, accessibilityIdentifier: String) {
        let frame = element.frame
        let entry: [String: Any] = [
            "element": accessibilityIdentifier,
            "x": frame.midX,
            "y": frame.midY,
            "width": frame.width,
            "height": frame.height,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
        ]
        entries.append(entry)
        flush()
    }

    private func flush() {
        guard let data = try? JSONSerialization.data(withJSONObject: entries, options: .prettyPrinted) else { return }
        try? data.write(to: URL(fileURLWithPath: filePath))
    }

    func reset() {
        entries = []
        try? FileManager.default.removeItem(atPath: filePath)
    }
}

extension XCUIElement {
    /// Tap with coordinate logging for Proof recordings.
    @discardableResult
    func proofTap(id: String? = nil) -> XCUIElement {
        let identifier = id ?? self.identifier
        ProofTapLogger.shared.log(element: self, accessibilityIdentifier: identifier)
        self.tap()
        return self
    }
}
