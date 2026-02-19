import { ReactNode } from 'react'

interface Props {
  type: 'none' | 'laptop' | 'phone';
  children: ReactNode;
}

function LaptopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      {/* Screen bezel */}
      <div className="bg-gray-900 rounded-t-xl p-2 pb-0 shadow-2xl">
        {/* Camera dot */}
        <div className="flex justify-center mb-1">
          <div className="w-2 h-2 rounded-full bg-gray-700" />
        </div>
        <div className="rounded-t-lg overflow-hidden bg-white">{children}</div>
      </div>
      {/* Stand */}
      <div className="w-[110%] h-3 bg-gradient-to-b from-gray-700 to-gray-600 rounded-b-lg" />
      <div className="w-[115%] h-1.5 bg-gray-500 rounded-b" />
    </div>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex flex-col items-center">
      <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
        {/* Notch / dynamic island */}
        <div className="flex justify-center mb-1.5">
          <div className="w-16 h-4 bg-black rounded-full" />
        </div>
        {/* Screen - use aspect ratio to stay responsive */}
        <div className="rounded-[2rem] overflow-hidden bg-white" style={{ width: 280, aspectRatio: '9/19.5' }}>
          <div className="w-full h-full" style={{ display: 'flex', alignItems: 'stretch' }}>
            {children}
          </div>
        </div>
        {/* Home indicator */}
        <div className="flex justify-center mt-2">
          <div className="w-24 h-1 bg-gray-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function DeviceFrame({ type, children }: Props) {
  switch (type) {
    case 'laptop':
      return <LaptopFrame>{children}</LaptopFrame>;
    case 'phone':
      return <PhoneFrame>{children}</PhoneFrame>;
    default:
      return <>{children}</>;
  }
}
