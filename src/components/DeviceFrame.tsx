import { ReactNode } from 'react'

interface Props {
  type: 'none' | 'laptop' | 'phone';
  children: ReactNode;
}

function LaptopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      {/* Screen */}
      <div className="bg-gray-900 rounded-t-xl p-2 pb-0 shadow-2xl">
        <div className="rounded-t-lg overflow-hidden bg-white">{children}</div>
      </div>
      {/* Base */}
      <div className="w-[110%] h-3 bg-gray-700 rounded-b-lg" />
      <div className="w-[115%] h-1.5 bg-gray-600 rounded-b" />
    </div>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex flex-col items-center">
      <div className="bg-gray-900 rounded-[2rem] p-2 shadow-2xl">
        {/* Notch */}
        <div className="flex justify-center mb-1">
          <div className="w-20 h-4 bg-gray-900 rounded-b-xl" />
        </div>
        <div className="rounded-[1.5rem] overflow-hidden bg-white w-[280px] h-[560px]">
          {children}
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
