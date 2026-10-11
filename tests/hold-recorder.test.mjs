import { test } from "node:test";
import assert from "node:assert/strict";
import { HoldRecorder } from "../src/lib/hold-recorder.ts";

function fixture(overrides = {}) {
  const calls = [];
  let time = 0;
  const capture = new HoldRecorder({
    prepare: async () => {
      calls.push("prepare");
    },
    record: () => {
      calls.push("record");
    },
    stop: async () => {
      calls.push("stop");
      return "file://audio.m4a";
    },
    cleanup: async () => {
      calls.push("cleanup");
    },
    submit: async () => {
      calls.push("submit");
    },
    phaseChanged: (phase) => calls.push(phase),
    error: (message) => calls.push(`error:${message}`),
    now: () => time,
    ...overrides,
  });
  return {
    capture,
    calls,
    advance: () => {
      time += 1000;
    },
  };
}

test("release during microphone preparation never starts or submits recording", async () => {
  let ready;
  const f = fixture({
    prepare: () =>
      new Promise((resolve) => {
        ready = resolve;
      }),
  });
  const preparing = f.capture.hold();
  await f.capture.release();
  ready();
  await preparing;
  assert.equal(f.calls.includes("record"), false);
  assert.equal(f.calls.includes("submit"), false);
  assert.ok(f.calls.includes("cleanup"));
});

test("holding then releasing submits once and deletes the recording", async () => {
  const f = fixture();
  await f.capture.hold();
  f.advance();
  await Promise.all([f.capture.release(), f.capture.release()]);
  assert.equal(f.calls.filter((c) => c === "submit").length, 1);
  assert.equal(f.calls.filter((c) => c === "stop").length, 1);
  assert.deepEqual(f.calls.slice(-2), ["cleanup", "idle"]);
});

test("background cancellation deletes recording without submitting", async () => {
  const f = fixture();
  await f.capture.hold();
  f.advance();
  await f.capture.release(false);
  assert.equal(f.calls.includes("submit"), false);
  assert.ok(f.calls.includes("cleanup"));
});

test("unmount during preparation cleans up without starting or updating UI", async () => {
  let ready;
  const f = fixture({
    prepare: () =>
      new Promise((resolve) => {
        ready = resolve;
      }),
  });
  const preparing = f.capture.hold();
  f.capture.dispose();
  ready();
  await preparing;
  assert.equal(f.calls.includes("record"), false);
  assert.equal(f.calls.includes("idle"), false);
  assert.ok(f.calls.includes("cleanup"));
});

test("brief taps are discarded and explain the hold gesture", async () => {
  const f = fixture();
  await f.capture.hold();
  await f.capture.release();
  assert.equal(f.calls.includes("submit"), false);
  assert.ok(f.calls.some((c) => c.startsWith("error:Hold")));
});

test("cancellation while stop is pending still prevents upload", async () => {
  let stopped;
  const f = fixture({
    stop: () =>
      new Promise((resolve) => {
        stopped = resolve;
      }),
  });
  await f.capture.hold();
  f.advance();
  const releasing = f.capture.release();
  await f.capture.release(false);
  stopped("file://audio.m4a");
  await releasing;
  assert.equal(f.calls.includes("submit"), false);
  assert.ok(f.calls.includes("cleanup"));
});

test("maximum duration sends once even if the finger remains down", async () => {
  let submitted;
  const done = new Promise((resolve) => {
    submitted = resolve;
  });
  const f = fixture({
    maxDurationMs: 5,
    submit: async () => {
      submitted();
    },
  });
  await f.capture.hold();
  f.advance();
  await done;
  await f.capture.release();
  assert.equal(f.calls.filter((c) => c === "stop").length, 1);
  f.capture.dispose();
});
