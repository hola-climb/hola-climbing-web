import { ref } from "vue";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { makeTrimmedName } from "@/utils/videoTrim";

type TrimLoadState = "unloaded" | "loading" | "ready" | "error";

export interface TrimResult {
  file: File;
  durationSeconds: number;
}

// ── 모듈 스코프 싱글톤 ──────────────────────────────────────────────
// 30MB 코어를 앱 세션당 한 번만 로드한다.
let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

// 진행률은 인스턴스 간 공유되도록 모듈 스코프 콜백 슬롯으로 라우팅.
let activeProgressCb: ((pct: number) => void) | null = null;

// ffmpeg stderr 최근 로그(실패 진단용 링 버퍼).
const recentLogs: string[] = [];
function pushLog(message: string) {
  recentLogs.push(message);
  if (recentLogs.length > 60) recentLogs.shift();
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ff = new FFmpeg();
    ff.on("progress", ({ progress }: { progress: number }) => {
      if (activeProgressCb) {
        const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
        activeProgressCb(pct);
      }
    });
    ff.on("log", ({ message }: { message: string }) => {
      pushLog(message);
      if (import.meta.env.DEV) console.debug("[ffmpeg]", message);
    });
    const base = `${import.meta.env.BASE_URL}ffmpeg`;
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegSingleton = ff;
    return ff;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    // 실패 시 재시도가 가능하도록 promise 를 비운다.
    loadPromise = null;
    throw err;
  }
}

/** 원본 파일명에서 ffmpeg 가상 FS 입력 파일명을 만든다 (확장자 보존). */
function inputNameFor(file: File): string {
  const m = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = m ? m[1].toLowerCase() : "mp4";
  return `input.${ext}`;
}

export function useVideoTrim() {
  const loadState = ref<TrimLoadState>(ffmpegSingleton ? "ready" : "unloaded");
  const trimProgress = ref(0);

  /** ffmpeg 코어를 (한 번만) 로드한다. 멱등. */
  async function ensureLoaded(): Promise<void> {
    if (ffmpegSingleton) {
      loadState.value = "ready";
      return;
    }
    loadState.value = "loading";
    try {
      await getFFmpeg();
      loadState.value = "ready";
    } catch (err) {
      loadState.value = "error";
      if (import.meta.env.DEV) console.error("ffmpeg load failed", err);
      throw err;
    }
  }

  /**
   * 영상을 [startSec, endSec] 구간으로 잘라 새 mp4 File 을 반환한다.
   * 기본은 스트림 복사(-c copy, 빠름·키프레임 단위). opts.reencode 시 프레임 정확(느림).
   */
  async function trim(file: File, startSec: number, endSec: number, opts?: { reencode?: boolean }): Promise<TrimResult> {
    const ff = await getFFmpeg();
    const duration = Math.max(0.1, endSec - startSec);
    const inName = inputNameFor(file);
    const outName = "output.mp4";

    trimProgress.value = 0;
    activeProgressCb = (pct) => {
      trimProgress.value = pct;
    };

    try {
      await ff.writeFile(inName, await fetchFile(file));
      recentLogs.length = 0;

      // 비디오+오디오 스트림만 매핑하고 데이터(타임코드 등)·자막 스트림은 드롭한다.
      // iPhone .mov 의 tmcd 같은 데이터 스트림은 mp4 로 복사 불가 → exit 1 의 흔한 원인.
      // `-t`(출력 길이)를 사용한다. `-ss`가 `-i` 앞에 올 때 `-to`는 원본 절대 타임스탬프로
      // 해석되어 음수 구간 → 빈 파일이 되는 함정이 있어 `-t`로 통일.
      // 기본 경로: 비디오는 스트림복사(빠름), 오디오만 AAC 로 재인코딩.
      // iPhone .mov 의 PCM(pcm_s16le) 오디오는 mp4 에 복사 불가하므로 항상 AAC 로 변환.
      const mapArgs = ["-map", "0:v:0", "-map", "0:a:0?", "-dn", "-sn"];
      const args = opts?.reencode
        ? ["-ss", String(startSec), "-i", inName, "-t", String(duration), ...mapArgs, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", outName]
        : ["-ss", String(startSec), "-i", inName, "-t", String(duration), ...mapArgs, "-c:v", "copy", "-c:a", "aac", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", outName];

      const ret = await ff.exec(args);
      if (ret !== 0) {
        const tail = recentLogs.slice(-8).join(" | ");
        throw new Error(`ffmpeg_exit_${ret}: ${tail}`);
      }

      const data = await ff.readFile(outName);
      if (typeof data === "string") throw new Error("unexpected_ffmpeg_string_output");
      if (data.length === 0) throw new Error("ffmpeg_empty_output");

      // 일반 ArrayBuffer 기반 Uint8Array 로 복사 (BlobPart 타입 호환 + 정확한 바이트 길이 보장).
      const bytes = new Uint8Array(data);
      const blob = new Blob([bytes], { type: "video/mp4" });
      const out = new File([blob], makeTrimmedName(file.name), { type: "video/mp4" });
      trimProgress.value = 100;
      return { file: out, durationSeconds: Math.round(duration) };
    } finally {
      // wasm 힙 메모리 해제 (실패해도 무시).
      try {
        await ff.deleteFile(inName);
      } catch {
        /* noop */
      }
      try {
        await ff.deleteFile(outName);
      } catch {
        /* noop */
      }
      activeProgressCb = null;
    }
  }

  /** ffmpeg 인스턴스를 종료하고 싱글톤을 비운다. */
  function dispose(): void {
    try {
      ffmpegSingleton?.terminate();
    } catch {
      /* noop */
    }
    ffmpegSingleton = null;
    loadPromise = null;
    activeProgressCb = null;
    loadState.value = "unloaded";
  }

  return { loadState, trimProgress, ensureLoaded, trim, dispose };
}
