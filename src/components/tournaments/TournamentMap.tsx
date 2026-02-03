'use client';

import { useEffect, useRef } from 'react';

interface TournamentMapProps {
    address: string | null;
    location: string;
}

declare global {
    interface Window {
        naver: any;
    }
}

export default function TournamentMap({ address, location }: TournamentMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);

    useEffect(() => {
        // 주소가 없으면 지도를 표시하지 않음
        if (!address && !location) return;

        const initMap = () => {
            if (!window.naver || !mapRef.current) {
                console.log('네이버 지도 API가 로드되지 않았습니다.');
                return;
            }

            // 주소 정리: 괄호 안의 내용 제거
            let searchAddress = (address || location).trim();
            searchAddress = searchAddress.replace(/\([^)]*\)/g, '').trim();
            
            console.log('지도 표시:', searchAddress);

            // Geocoding 서비스 사용
            if (window.naver.maps.Service && window.naver.maps.Service.geocode) {
                window.naver.maps.Service.geocode(
                    {
                        query: searchAddress,
                    },
                    function (status: any, response: any) {
                        console.log('Geocoding 응답:', { status, response });
                        
                        if (status !== window.naver.maps.Service.Status.OK) {
                            console.warn('주소 검색 실패. 기본 위치를 표시합니다.');
                            createMap(37.5665, 126.9780, searchAddress);
                            return;
                        }

                        // 응답 결과에서 좌표 추출
                        let result = null;
                        if (response.v2 && response.v2.addresses && response.v2.addresses.length > 0) {
                            result = response.v2.addresses[0];
                        } else if (response.result && response.result.items && response.result.items.length > 0) {
                            result = response.result.items[0];
                        }

                        if (result) {
                            const lat = parseFloat(result.y || result.mapy);
                            const lng = parseFloat(result.x || result.mapx);
                            if (!isNaN(lat) && !isNaN(lng)) {
                                console.log('좌표 찾음:', { lat, lng });
                                createMap(lat, lng, searchAddress);
                                return;
                            }
                        }
                        
                        // 좌표를 찾지 못한 경우 기본 위치
                        console.warn('좌표 변환 실패. 기본 위치를 표시합니다.');
                        createMap(37.5665, 126.9780, searchAddress);
                    }
                );
            } else {
                console.warn('Geocoding 서비스를 사용할 수 없습니다. 기본 위치를 표시합니다.');
                createMap(37.5665, 126.9780, searchAddress);
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
        if (typeof window !== 'undefined') {
            if (window.naver && window.naver.maps) {
                // 이미 로드되어 있으면 바로 초기화
                initMap();
            } else {
                // 스크립트가 없으면 로드 (geocoder 서브모듈 포함)
                const script = document.createElement('script');
                script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=geocoder`;
                script.async = true;
                script.onload = () => {
                    // 스크립트 로드 후 약간의 딜레이를 주고 초기화
                    setTimeout(() => {
                        initMap();
                    }, 100);
                };
                script.onerror = () => {
                    console.error('네이버 지도 스크립트 로드 실패. API 키와 웹 서비스 URL을 확인하세요.');
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
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl h-64 flex items-center justify-center text-gray-400 border border-gray-200 dark:border-gray-700">
                <div className="text-center">
                    <span className="text-4xl block mb-2">🗺️</span>
                    <span className="text-sm">주소 정보가 없습니다</span>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
            <div ref={mapRef} className="w-full h-64" />
            <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    📍 {address || location}
                </p>
            </div>
        </div>
    );
}
