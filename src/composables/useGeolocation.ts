import { ref, type Ref } from "vue";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

export type GeolocationError = "denied" | "unavailable" | "failed";

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * 현재 위치 1회 조회 컴포저블. Capacitor Geolocation 플러그인을 사용하며
 * 웹에서는 브라우저 Geolocation API로 폴백한다. 권한 거부/실패는 `error`로
 * 노출하고, 토스트 등 사용자 노출은 호출부에서 처리한다.
 */
export function useGeolocation(): {
  coords: Ref<Coords | null>;
  isLocating: Ref<boolean>;
  error: Ref<GeolocationError | null>;
  locate: () => Promise<Coords | null>;
} {
  const coords = ref<Coords | null>(null);
  const isLocating = ref(false);
  const error = ref<GeolocationError | null>(null);

  async function locate(): Promise<Coords | null> {
    isLocating.value = true;
    error.value = null;
    try {
      // checkPermissions/requestPermissions는 웹에서 "Not implemented" 예외를
      // 던진다 — 웹은 getCurrentPosition 호출 시 브라우저가 자체 권한 프롬프트를
      // 띄우므로 네이티브(iOS/Android)에서만 사전 권한 확인을 수행한다.
      if (Capacitor.getPlatform() !== "web") {
        const status = await Geolocation.checkPermissions();
        if (status.location === "denied") {
          const req = await Geolocation.requestPermissions();
          if (req.location === "denied") {
            error.value = "denied";
            return null;
          }
        }
      }

      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000 });
      coords.value = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      return coords.value;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 권한 거부 메시지는 플러그인/브라우저마다 다르게 내려온다.
      error.value = /denied|permission/i.test(msg) ? "denied" : "failed";
      if (import.meta.env.DEV) console.error("useGeolocation:", e);
      return null;
    } finally {
      isLocating.value = false;
    }
  }

  return { coords, isLocating, error, locate };
}
