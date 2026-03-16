import XCTest

final class ProofTestAppUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testTapButton() throws {
        let app = XCUIApplication()
        app.launch()

        let messageLabel = app.staticTexts["messageLabel"]
        XCTAssertEqual(messageLabel.label, "Hello, World!")

        let tapButton = app.buttons["tapButton"]
        tapButton.tap()

        XCTAssertEqual(messageLabel.label, "You tapped!")

        tapButton.tap()
        XCTAssertEqual(messageLabel.label, "Tapped 2x!")

        tapButton.tap()
        XCTAssertEqual(messageLabel.label, "Tapped 3x!")

        let resetButton = app.buttons["resetButton"]
        resetButton.tap()

        XCTAssertEqual(messageLabel.label, "Hello, World!")
    }
}
