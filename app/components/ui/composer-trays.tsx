import type { ReactNode } from "react";

type ComposerTrayFrameProps = {
  children: ReactNode;
};

type ComposerHorizontalTrayProps = {
  children: ReactNode;
};

type ComposerPanelTrayProps = {
  children: ReactNode;
  title: string;
};

export function ComposerTrayFrame({ children }: ComposerTrayFrameProps) {
  return (
    <div className="absolute inset-x-0 bottom-full border-y-2 border-black bg-white">
      {children}
    </div>
  );
}

export function ComposerHorizontalTray({ children }: ComposerHorizontalTrayProps) {
  return (
    <div className="overflow-x-auto px-3 py-3">
      <div className="flex min-w-max items-stretch gap-2">{children}</div>
    </div>
  );
}

export function ComposerPanelTray({ children, title }: ComposerPanelTrayProps) {
  return (
    <div className="max-h-[50dvh] overflow-y-auto p-3">
      <div className="space-y-3">
        <p className="text-sm font-bold uppercase tracking-[0.08em]">{title}</p>
        {children}
      </div>
    </div>
  );
}
