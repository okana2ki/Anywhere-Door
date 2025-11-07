import React from 'react';

interface DoorProps {
  isOpen: boolean;
  children?: React.ReactNode;
}

const Door: React.FC<DoorProps> = ({ isOpen, children }) => {
  return (
    <div className="relative w-[300px] h-[500px] md:w-[350px] md:h-[580px] perspective-[1200px]">
      {/* The view behind the door */}
      <div className="absolute inset-0 z-0 rounded-lg overflow-hidden shadow-inner">
        {children}
      </div>

      {/* Single Door Panel */}
      <div
        className={`absolute top-0 left-0 w-full h-full bg-pink-500 origin-left transition-transform duration-1000 ease-in-out transform-style-3d z-10`}
        style={{ transform: isOpen ? 'rotateY(-140deg)' : 'rotateY(0deg)' }}
      >
        <div className="relative w-full h-full border-[12px] border-pink-600 rounded-lg flex items-center justify-end p-4 shadow-2xl">
           {/* Door Knob */}
           <div className="w-8 h-8 md:w-10 md:h-10 bg-green-400 rounded-full border-2 border-green-600 shadow-md mr-4"></div>
        </div>
      </div>
    </div>
  );
};

export default Door;