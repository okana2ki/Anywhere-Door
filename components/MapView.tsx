
import React, { useMemo, useState } from 'react';
import type { ViewType } from '../types';

interface MapViewProps {
  location: string;
  viewType: ViewType;
  apiKey: string;
}

const MapView: React.FC<MapViewProps> = ({ location, viewType, apiKey }) => {
  const [isLoading, setIsLoading] = useState(true);

  const mapSrc = useMemo(() => {
    if (!location || !apiKey) return '';
    const encodedLocation = encodeURIComponent(location);
    if (viewType === 'street') {
      return `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${encodedLocation}`;
    } else {
      return `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${encodedLocation}&maptype=satellite&zoom=18`;
    }
  }, [location, viewType, apiKey]);
  
  if (!apiKey) {
      return (
        <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center text-white p-4 text-center">
            <h3 className="text-xl font-bold text-red-400 mb-2">設定エラー</h3>
            <p className="text-sm">Google Maps APIキーが設定されていません。アプリを正しく動作させるためには、環境変数の設定が必要です。</p>
        </div>
      );
  }

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10">
          <div className="w-16 h-16 border-4 border-t-transparent border-white rounded-full animate-spin"></div>
        </div>
      )}
      <iframe
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={mapSrc}
        onLoad={() => setIsLoading(false)}
      ></iframe>
    </div>
  );
};

export default MapView;
