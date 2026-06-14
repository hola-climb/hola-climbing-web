import { describe, expect, test } from "vitest";
import { makeTrimmedName, clampSelection, formatMMSS } from "@/utils/videoTrim";

describe("makeTrimmedName", () => {
  test("replaces extension with _trimmed.mp4", () => {
    expect(makeTrimmedName("clip.mov")).toBe("clip_trimmed.mp4");
    expect(makeTrimmedName("my video.MP4")).toBe("my video_trimmed.mp4");
  });
  test("handles no extension", () => {
    expect(makeTrimmedName("clip")).toBe("clip_trimmed.mp4");
  });
  test("falls back to 'video' when name is empty", () => {
    expect(makeTrimmedName(".mov")).toBe("video_trimmed.mp4");
    expect(makeTrimmedName("")).toBe("video_trimmed.mp4");
  });
});

describe("clampSelection", () => {
  test("keeps valid selection within bounds", () => {
    expect(clampSelection(5, 20, 60)).toEqual({ start: 5, end: 20 });
  });
  test("clamps to duration", () => {
    expect(clampSelection(-3, 90, 60)).toEqual({ start: 0, end: 60 });
  });
  test("swaps when end < start", () => {
    expect(clampSelection(30, 10, 60)).toEqual({ start: 10, end: 30 });
  });
  test("ensures end > start when equal", () => {
    const r = clampSelection(10, 10, 60);
    expect(r.start).toBe(10);
    expect(r.end).toBeGreaterThan(10);
  });
});

describe("formatMMSS", () => {
  test("formats seconds as M:SS", () => {
    expect(formatMMSS(0)).toBe("0:00");
    expect(formatMMSS(9)).toBe("0:09");
    expect(formatMMSS(75.4)).toBe("1:15");
    expect(formatMMSS(600)).toBe("10:00");
  });
  test("never goes negative", () => {
    expect(formatMMSS(-5)).toBe("0:00");
  });
});
