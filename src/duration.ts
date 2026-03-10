import { spawn } from "child_process";

export async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const output = await new Promise<string>((resolve, reject) => {
      const proc = spawn("ffprobe", [
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        filePath,
      ], { stdio: ["ignore", "pipe", "pipe"] });

      let stdout = "";
      proc.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
      proc.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error("ffprobe failed")));
      proc.on("error", reject);
    });

    const parsed = JSON.parse(output);
    const seconds = parseFloat(parsed.format?.duration ?? "0");
    return Math.round(seconds * 1000);
  } catch {
    return 0;
  }
}
