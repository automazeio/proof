import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

export interface TapEvent {
  element: string;
  timestamp: Date;
  durationMs: number;
}

export function findLatestXcresult(derivedDataPath?: string): string | null {
  const base = derivedDataPath ??
    join(process.env.HOME ?? "/", "Library/Developer/Xcode/DerivedData");

  try {
    const result = execSync(
      `find "${base}" -name "*.xcresult" -maxdepth 5 -print0 | xargs -0 ls -dt 2>/dev/null | head -1`,
      { encoding: "utf-8" },
    ).trim();
    return result && existsSync(result) ? result : null;
  } catch {
    return null;
  }
}

export function parseTapEvents(xcresultPath: string): TapEvent[] {
  try {
    const rootJson = execSync(
      `xcrun xcresulttool get object --legacy --path "${xcresultPath}" --format json`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    );
    const root = JSON.parse(rootJson);

    const testsRefId = findRef(root, "testsRef");
    if (!testsRefId) return [];

    const testsJson = execSync(
      `xcrun xcresulttool get object --legacy --path "${xcresultPath}" --id "${testsRefId}" --format json`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    );
    const tests = JSON.parse(testsJson);

    const summaryRefId = findRef(tests, "summaryRef");
    if (!summaryRefId) return [];

    const summaryJson = execSync(
      `xcrun xcresulttool get object --legacy --path "${xcresultPath}" --id "${summaryRefId}" --format json`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    );
    const summary = JSON.parse(summaryJson);

    const events: TapEvent[] = [];
    collectTapActivities(summary, events);
    return events;
  } catch {
    return [];
  }
}

function findRef(obj: any, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  if (key in obj) {
    const ref = obj[key];
    if (ref?.id?._value) return ref.id._value;
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        const found = findRef(item, key);
        if (found) return found;
      }
    } else if (typeof v === "object" && v !== null) {
      const found = findRef(v, key);
      if (found) return found;
    }
  }
  return null;
}

function collectTapActivities(obj: any, events: TapEvent[]): void {
  if (!obj || typeof obj !== "object") return;

  const typeName = obj?._type?._name ?? "";
  if (typeName.includes("ActivitySummary")) {
    const title: string = obj?.title?._value ?? "";
    const tapMatch = title.match(/^Tap "(.+)"/);
    if (tapMatch) {
      const start = obj?.start?._value;
      const finish = obj?.finish?._value;
      if (start) {
        const startDate = new Date(start);
        const finishDate = finish ? new Date(finish) : startDate;
        events.push({
          element: tapMatch[1],
          timestamp: startDate,
          durationMs: finishDate.getTime() - startDate.getTime(),
        });
      }
    }
  }

  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) collectTapActivities(item, events);
    } else if (typeof v === "object" && v !== null) {
      collectTapActivities(v, events);
    }
  }
}
