export type RecordingMode = "browser" | "terminal" | "simulator" | "auto";

export interface ProofConfig {
  appName: string;
  description?: string;
  proofDir?: string;
  run?: string;
  browser?: {
    viewport?: { width: number; height: number };
  };
  terminal?: {
    cols?: number;
    rows?: number;
  };
}

export interface Recording {
  path: string;
  mode: Exclude<RecordingMode, "auto">;
  duration: number;
  label?: string;
  /**
   * Exit code of the wrapped command / test process. `0` means success;
   * any non-zero value (including a normalized `1` for signal-kills or spawn
   * failures) means the wrapped command failed. Always populated.
   */
  exitCode: number;
}

export interface CaptureOptions {
  command?: string;
  testFile?: string;
  testName?: string;
  label?: string;
  mode?: RecordingMode;
  format?: "video" | "raw";
  description?: string;
  device?: string | string[];
  viewport?: string | string[];
  platform?: "ios" | "android";
  simulator?: {
    deviceName?: string;
    deviceId?: string;
    os?: string;
    codec?: string;
    bitRate?: number;
    size?: string;
  };
}

export interface ProofEntry {
  timestamp: string;
  mode: Exclude<RecordingMode, "auto">;
  label?: string;
  command?: string;
  testFile?: string;
  testName?: string;
  duration: number;
  artifact: string;
  description: string;
  device?: string;
  viewport?: string;
  platform?: "ios" | "android";
  /**
   * Exit code of the wrapped command. Optional so manifests written before
   * this field existed still parse; readers treat a missing value as "unknown"
   * (rendered as "—"), never as a failure.
   */
  exitCode?: number;
}

export interface ProofManifest {
  version: 1;
  appName: string;
  description?: string;
  run: string;
  createdAt: string;
  entries: ProofEntry[];
}

export type ReportFormat = "md" | "html" | "archive";

export interface ReportOptions {
  format?: ReportFormat | ReportFormat[];
}
