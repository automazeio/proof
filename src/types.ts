export type RecordingMode = "browser" | "terminal" | "auto";

export interface ProofConfig {
  appName: string;
  proofDir?: string;
  run?: string;
  browser?: {
    viewport?: { width: number; height: number };
    videosOnFailureOnly?: boolean;
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
}

export interface CaptureOptions {
  testFile: string;
  testName?: string;
  label?: string;
  mode?: RecordingMode;
  description?: string;
}

export interface ProofEntry {
  timestamp: string;
  mode: Exclude<RecordingMode, "auto">;
  label?: string;
  testFile: string;
  testName?: string;
  duration: number;
  artifact: string;
  description: string;
}

export interface ProofManifest {
  version: 1;
  appName: string;
  run: string;
  createdAt: string;
  entries: ProofEntry[];
}
