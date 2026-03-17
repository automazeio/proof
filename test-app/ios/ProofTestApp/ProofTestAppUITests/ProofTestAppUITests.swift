import XCTest

final class ProofTestAppUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
        ProofTapLogger.shared.reset()
    }

    func testTapButton() throws {
        let app = XCUIApplication()
        app.launch()

        let messageLabel = app.staticTexts["messageLabel"]
        XCTAssertEqual(messageLabel.label, "Hello, World!")

        let tapButton = app.buttons["tapButton"]
        tapButton.proofTap()

        XCTAssertEqual(messageLabel.label, "You tapped!")

        tapButton.proofTap()
        XCTAssertEqual(messageLabel.label, "Tapped 2x!")

        tapButton.proofTap()
        XCTAssertEqual(messageLabel.label, "Tapped 3x!")

        let resetButton = app.buttons["resetButton"]
        resetButton.proofTap()

        XCTAssertEqual(messageLabel.label, "Hello, World!")
    }
}
