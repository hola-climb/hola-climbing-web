/**
 * 카카오맵 JS SDK 로더. 스크립트를 1회만 주입하고(싱글턴 Promise),
 * `autoload=false` + `kakao.maps.load()`로 모듈 로드 완료 시점을 보장한다.
 * `VITE_KAKAO_MAP_KEY`가 없으면 reject → 호출부에서 mock 지도로 폴백한다.
 */
let loadPromise: Promise<void> | null = null;

export function loadKakaoMaps(): Promise<void> {
  if (window.kakao?.maps?.Map) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const appKey = import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined;

  loadPromise = new Promise<void>((resolve, reject) => {
    if (!appKey) {
      reject(new Error("VITE_KAKAO_MAP_KEY가 설정되지 않았습니다."));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => resolve());
    script.onerror = () => {
      loadPromise = null; // 재시도 허용
      reject(new Error("카카오맵 SDK를 불러오지 못했습니다."));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
