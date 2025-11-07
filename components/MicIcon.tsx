
import React from 'react';

interface MicIconProps {
  isListening: boolean;
}

const MicIcon: React.FC<MicIconProps> = ({ isListening }) => {
  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      {isListening && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/75 opacity-75"></span>
      )}
      <div className="relative w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm5 4a1 1 0 10-2 0v1a1 1 0 102 0V8z" clipRule="evenodd" />
          <path d="M5.992 10.992a.75.75 0 01.53-.223h7a.75.75 0 01.53.223l.1.101A5.003 5.003 0 0116 15a1 1 0 11-2 0 3 3 0 00-6 0 1 1 0 11-2 0c0-1.07.31-2.076.868-2.906l.101-.1z" />
        </svg>
      </div>
    </div>
  );
};

export default MicIcon;
