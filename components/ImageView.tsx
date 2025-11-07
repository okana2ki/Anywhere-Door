import React, { useState, useEffect } from 'react';

interface ImageViewProps {
  url: string;
  isRotating?: boolean;
}

const ImageView: React.FC<ImageViewProps> = ({ url, isRotating = false }) => {
  const [isImageLoading, setIsImageLoading] = useState(true);

  useEffect(() => {
    if (!url) {
        setIsImageLoading(false);
        return;
    };

    setIsImageLoading(true);
    const img = new Image();
    img.src = url;
    img.onload = () => setIsImageLoading(false);
    img.onerror = () => {
        console.error("Failed to load image:", url);
        setIsImageLoading(false);
    };
  }, [url]);

  if (!url) {
    return <div className="w-full h-full bg-gray-800" />;
  }

  return (
    <div className="w-full h-full relative bg-black overflow-hidden">
      {isImageLoading && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
          <div className="w-16 h-16 border-4 border-t-transparent border-white rounded-full animate-spin"></div>
        </div>
      )}
      <img
        src={url}
        alt="Location view"
        className={`w-full h-full object-cover transition-opacity duration-500 ${isImageLoading ? 'opacity-0' : 'opacity-100'} ${isRotating ? 'animate-slow-spin' : ''}`}
      />
    </div>
  );
};

export default ImageView;