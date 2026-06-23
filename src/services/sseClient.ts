import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

/**
 * 네이티브 SSE 플러그인 인터페이스 (iOS: HolaSsePlugin.swift).
 *
 * WKWebView 의 fetch 가 SSE 스트림을 버퍼링해 동작하지 않으므로,
 * 네이티브에서 URLSession 으로 스트리밍하고 완성된 프레임을 JS 로 전달한다.
 * event/data 파싱은 JS(streamAnalysis)에서 웹과 동일 로직으로 처리한다.
 */
export interface HolaSsePlugin {
  /** SSE 연결 시작. 스트림 식별용 id 반환. */
  connect(opts: { url: string; token?: string }): Promise<{ id: string }>;
  /** id 로 해당 스트림 종료(URLSession task cancel). */
  disconnect(opts: { id: string }): Promise<void>;
  addListener(
    eventName: "sseMessage" | "sseClose" | "sseError",
    listenerFunc: (event: { id: string; data?: string; message?: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const HolaSse = registerPlugin<HolaSsePlugin>("HolaSse");
