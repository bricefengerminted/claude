// ---- Video recording project types ----

export interface TrimRange {
  startSec: number;
  endSec: number;
}

export interface VideoSettings {
  playbackSpeed: number;   // 0.25 - 2.0
  trim: TrimRange | null;  // null = no trimming
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  playbackSpeed: 1.0,
  trim: null,
};

// ---- Analysis types ----

export interface VideoSegment {
  startSec: number;
  endSec: number;
  type: 'active' | 'dead';
  avgChangeScore: number; // 0-1
}

export interface ZoomKeyframe {
  timeSec: number;
  x: number;       // focus center x (0-1)
  y: number;       // focus center y (0-1)
  scale: number;   // 1.0 = no zoom, 2.0 = 2x
}

export interface AnalysisResult {
  segments: VideoSegment[];
  zoomKeyframes: ZoomKeyframe[];
  totalDuration: number;
  frameCount: number;
}

export interface DemoProject {
  id: string;
  name: string;
  videoUrl: string;        // object URL for the recorded blob
  videoBlob: Blob;         // the raw recorded video
  settings: VideoSettings;
  analysis: AnalysisResult | null;
  createdAt: number;
  duration: number;        // seconds
}

// Keep legacy types around so existing engine files don't break on import
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

export interface EnhancementSettings {
  cursorSmoothing: number;
  scrollSmoothing: number;
  playbackSpeed: number;
  maxPauseMs: number;
  clickHighlight: boolean;
  autoZoom: boolean;
}

export const DEFAULT_SETTINGS: EnhancementSettings = {
  cursorSmoothing: 70,
  scrollSmoothing: 80,
  playbackSpeed: 1.0,
  maxPauseMs: 1500,
  clickHighlight: true,
  autoZoom: false,
};
