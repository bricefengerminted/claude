// ---- rrweb event types (subset we need for enhancement) ----

export enum EventType {
  DomContentLoaded = 0,
  Load = 1,
  FullSnapshot = 2,
  IncrementalSnapshot = 3,
  Meta = 4,
  Custom = 5,
  Plugin = 6,
}

export enum IncrementalSource {
  Mutation = 0,
  MouseMove = 1,
  MouseInteraction = 2,
  Scroll = 3,
  ViewportResize = 4,
  Input = 5,
  TouchMove = 6,
  MediaInteraction = 7,
  StyleSheetRule = 8,
  CanvasMutation = 9,
  Font = 10,
  Log = 11,
  Drag = 12,
  StyleDeclaration = 13,
  Selection = 14,
}

export enum MouseInteractions {
  MouseUp = 0,
  MouseDown = 1,
  Click = 2,
  ContextMenu = 3,
  DblClick = 4,
  Focus = 5,
  Blur = 6,
  TouchStart = 7,
  TouchEnd = 9,
}

export interface Position {
  x: number;
  y: number;
  id: number;
  timeOffset: number;
}

export interface RRWebEvent {
  type: EventType;
  data: any;
  timestamp: number;
}

// ---- App types ----

export interface EnhancementSettings {
  cursorSmoothing: number;   // 0-100, how much to smooth cursor paths
  scrollSmoothing: number;   // 0-100, how much to smooth scrolling
  playbackSpeed: number;     // 0.25 - 2.0
  maxPauseMs: number;        // max pause between actions (ms)
  clickHighlight: boolean;   // add visual click effects
  autoZoom: boolean;         // zoom into areas of activity
}

export const DEFAULT_SETTINGS: EnhancementSettings = {
  cursorSmoothing: 70,
  scrollSmoothing: 80,
  playbackSpeed: 1.0,
  maxPauseMs: 1500,
  clickHighlight: true,
  autoZoom: false,
};

export interface DemoProject {
  id: string;
  name: string;
  rawEvents: RRWebEvent[];
  enhancedEvents: RRWebEvent[] | null;
  settings: EnhancementSettings;
  createdAt: number;
  duration: number;
}
