export type RecordingMode = "visual" | "terminal" | "test-output" | "auto";

export type GitHubUploadMethod = "assets" | "comment-link";

export interface ProofConfig {
  repo: string;
  githubToken?: string;
  mode?: RecordingMode;
  workDir?: string;
  visual?: {
    viewport?: { width: number; height: number };
    videosOnFailureOnly?: boolean;
  };
  terminal?: {
    cols?: number;
    rows?: number;
    convertToGif?: boolean;
  };
  github?: {
    uploadMethod?: GitHubUploadMethod;
  };
  maxVideoLength?: number;
  retention?: {
    maxAge?: number;
    maxRuns?: number;
  };
}

export interface Recording {
  path: string;
  mode: Exclude<RecordingMode, "auto">;
  duration: number;
  label?: string;
}

export interface CompareResult {
  before: Recording;
  after: Recording;
  mode: Exclude<RecordingMode, "auto">;
}

export interface CaptureOptions {
  testFile: string;
  testName?: string;
  label?: string;
}

export interface CompareOptions {
  testFile: string;
  testName?: string;
  beforeRef: string;
  afterRef?: string;
}

export interface AttachToPROptions {
  prNumber: number;
  recordings: Recording | CompareResult;
  comment?: string;
}

export interface AttachToIssueOptions {
  issueNumber: number;
  recording: Recording;
  comment?: string;
}

export interface RecordSuiteOptions {
  command: string;
  captureVideo?: boolean;
  captureOutput?: boolean;
}

export interface RecordSuiteResult {
  videos: Recording[];
  output: string;
  passed: boolean;
}

export interface RunInfo {
  id: string;
  createdAt: Date;
  files: string[];
  sizeBytes: number;
}

export interface CleanupOptions {
  maxAge?: number;
  maxRuns?: number;
}
