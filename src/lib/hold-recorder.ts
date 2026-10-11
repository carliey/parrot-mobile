export type RecordingPhase = "idle" | "preparing" | "recording" | "sending";
type Options = {
  prepare: () => Promise<void>;
  record: () => void;
  stop: () => Promise<string | null>;
  cleanup: (uri: string | null) => Promise<void>;
  submit: (uri: string) => Promise<void>;
  phaseChanged: (phase: RecordingPhase) => void;
  error: (message: string) => void;
  now?: () => number;
  maxDurationMs?: number;
};

/** Owns the press/release lifecycle, including release during async preparation. */
export class HoldRecorder {
  private phase: RecordingPhase = "idle";
  private held = false;
  private disposed = false;
  private cancelled = false;
  private startedAt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private options: Options;

  constructor(options: Options) {
    this.options = options;
  }
  private setPhase(phase: RecordingPhase) {
    this.phase = phase;
    if (!this.disposed) this.options.phaseChanged(phase);
  }
  private report(error: unknown) {
    if (!this.disposed)
      this.options.error(
        error instanceof Error
          ? error.message
          : "Recording failed. Please try again.",
      );
  }
  async hold() {
    if (this.disposed || this.phase !== "idle") return;
    this.held = true;
    this.cancelled = false;
    this.setPhase("preparing");
    try {
      await this.options.prepare();
      if (!this.held || this.disposed) {
        const uri = await this.options.stop();
        await this.options.cleanup(uri);
        this.setPhase("idle");
        return;
      }
      this.options.record();
      this.startedAt = (this.options.now ?? Date.now)();
      this.setPhase("recording");
      // Stay below the backend's 30-second limit.
      this.timer = setTimeout(() => {
        void this.release();
      }, this.options.maxDurationMs ?? 28000);
    } catch (error) {
      this.held = false;
      const uri = await this.options.stop().catch(() => null);
      await this.options.cleanup(uri).catch(() => {});
      this.setPhase("idle");
      this.report(error);
    }
  }
  async release(send = true) {
    this.held = false;
    if (!send) this.cancelled = true;
    if (this.phase !== "recording") return;
    clearTimeout(this.timer);
    this.setPhase("sending");
    let uri: string | null = null;
    try {
      uri = await this.options.stop();
      if (send && !this.disposed && !this.cancelled) {
        if ((this.options.now ?? Date.now)() - this.startedAt < 350) {
          throw new Error(
            "Hold the microphone while you speak, then release to send.",
          );
        }
        if (!uri)
          throw new Error("Recording is unavailable. Please try again.");
        await this.options.submit(uri);
      }
    } catch (error) {
      this.report(error);
    } finally {
      await this.options.cleanup(uri).catch(() => {});
      this.setPhase("idle");
    }
  }
  dispose() {
    this.disposed = true;
    this.held = false;
    clearTimeout(this.timer);
    void this.release(false);
  }
}
