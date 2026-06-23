/**
 * 카카오맵 JS SDK (dapi.kakao.com/v2/maps) 최소 타입 선언.
 * 프로젝트에서 실제 사용하는 표면만 선언한다. SDK는 런타임에 스크립트로
 * 주입되며 `window.kakao.maps`로 접근한다.
 */
export {};

declare global {
  namespace kakao.maps {
    class LatLng {
      constructor(lat: number, lng: number);
      getLat(): number;
      getLng(): number;
    }

    class LatLngBounds {
      constructor();
      extend(latlng: LatLng): void;
      isEmpty(): boolean;
    }

    class Size {
      constructor(width: number, height: number);
    }

    class Point {
      constructor(x: number, y: number);
    }

    interface MapOptions {
      center: LatLng;
      level?: number;
      draggable?: boolean;
    }

    class Map {
      constructor(container: HTMLElement, options: MapOptions);
      setCenter(latlng: LatLng): void;
      panTo(latlng: LatLng): void;
      setLevel(level: number): void;
      getLevel(): number;
      setBounds(bounds: LatLngBounds): void;
      relayout(): void;
    }

    interface MarkerImageOptions {
      offset?: Point;
    }

    class MarkerImage {
      constructor(src: string, size: Size, options?: MarkerImageOptions);
    }

    interface MarkerOptions {
      position: LatLng;
      map?: Map;
      image?: MarkerImage;
      title?: string;
      zIndex?: number;
      clickable?: boolean;
    }

    class Marker {
      constructor(options: MarkerOptions);
      setMap(map: Map | null): void;
      setPosition(latlng: LatLng): void;
      getPosition(): LatLng;
    }

    namespace event {
      function addListener(target: object, type: string, handler: () => void): void;
    }

    function load(callback: () => void): void;
  }

  interface Window {
    kakao: typeof kakao;
  }
}
