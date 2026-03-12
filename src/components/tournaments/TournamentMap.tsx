"use client";

import { useEffect, useRef } from "react";

interface TournamentMapProps {
  address: string | null;
  location: string;
}

declare global {
  interface Window {
    naver: any;
  }
}

export default function TournamentMap({
  address,
  location,
}: TournamentMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // 주소가 없으면 지도를 표시하지 않음
    if (!address && !location) return;

    const initMap = () => {
      if (!window.naver || !mapRef.current) {
        return;
      }

      // 주소 정리: 괄호 안의 내용 제거
      let searchAddress = (address || location).trim();
      searchAddress = searchAddress.replace(/\([^)]*\)/g, "").trim();

      // Geocoding 서비스 사용
      if (window.naver.maps.Service && window.naver.maps.Service.geocode) {
        window.naver.maps.Service.geocode(
          {
            query: searchAddress,
          },
          function (status: any, response: any) {
            if (status !== window.naver.maps.Service.Status.OK) {
              createMap(37.5665, 126.978, searchAddress);
              return;
            }

            // 응답 결과에서 좌표 추출
            let result = null;
            if (
              response.v2 &&
              response.v2.addresses &&
              response.v2.addresses.length > 0
            ) {
              result = response.v2.addresses[0];
            } else if (
              response.result &&
              response.result.items &&
              response.result.items.length > 0
            ) {
              result = response.result.items[0];
            }

            if (result) {
              const lat = parseFloat(result.y || result.mapy);
              const lng = parseFloat(result.x || result.mapx);
              if (!isNaN(lat) && !isNaN(lng)) {
                createMap(lat, lng, searchAddress);
                return;
              }
            }

            createMap(37.5665, 126.978, searchAddress);
          },
        );
      } else {
        createMap(37.5665, 126.978, searchAddress);
      }
    };

    const createMap = (lat: number, lng: number, title: string) => {
      if (!mapRef.current) return;

      const mapOptions = {
        center: new window.naver.maps.LatLng(lat, lng),
        zoom: 16,
        zoomControl: true,
        zoomControlOptions: {
          position: window.naver.maps.Position.TOP_RIGHT,
        },
      };

      const map = new window.naver.maps.Map(mapRef.current, mapOptions);
      mapInstanceRef.current = map;

      // 마커 추가
      new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(lat, lng),
        map: map,
        title: title,
      });
    };

    // 네이버 지도 스크립트 로드
    if (typeof window !== "undefined") {
      if (window.naver && window.naver.maps) {
        initMap();
      } else {
        const script = document.createElement("script");
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=geocoder`;
        script.async = true;
        script.onload = () => {
          setTimeout(() => {
            initMap();
          }, 100);
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
      }
    };
  }, [address, location]);

  if (!address && !location) {
    return (
      <div
        className="rounded-2xl h-64 flex items-center justify-center"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          color: "var(--text-muted)",
        }}
      >
        <div className="text-center">
          <span className="text-4xl block mb-2">🗺️</span>
          <span className="text-sm">주소 정보가 없습니다</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--border-color)", isolation: "isolate" }}
    >
      <div ref={mapRef} className="w-full h-64" />
      <div
        className="px-4 py-3"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderTop: "1px solid var(--border-color)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          📍 {address || location}
        </p>
      </div>
    </div>
  );
}
