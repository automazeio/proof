# Homebrew formula for proof
# Repository: automazeio/homebrew-tap
# Install: brew install automazeio/tap/proof
#
# This file lives in the proof repo as a reference.
# The actual formula is in github.com/automazeio/homebrew-tap/Formula/proof.rb
# and is auto-updated by the release workflow.

class Proof < Formula
  desc "Capture visual evidence of test execution"
  homepage "https://github.com/automazeio/proof"
  version "0.20260312.1"
  license "Apache-2.0"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/automazeio/proof/releases/download/v#{version}/proof-darwin-arm64"
      sha256 "PLACEHOLDER"
    else
      url "https://github.com/automazeio/proof/releases/download/v#{version}/proof-darwin-x64"
      sha256 "PLACEHOLDER"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/automazeio/proof/releases/download/v#{version}/proof-linux-arm64"
      sha256 "PLACEHOLDER"
    else
      url "https://github.com/automazeio/proof/releases/download/v#{version}/proof-linux-x64"
      sha256 "PLACEHOLDER"
    end
  end

  def install
    binary_name = stable.url.split("/").last
    bin.install binary_name => "proof"
  end

  test do
    assert_match "proof", shell_output("#{bin}/proof --help 2>&1", 0)
  end
end
