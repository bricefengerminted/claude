import { createContext, useContext, useReducer, ReactNode } from 'react'
import { DemoProject, VideoSettings, AnalysisResult, DEFAULT_VIDEO_SETTINGS } from '../types'

interface State {
  projects: DemoProject[];
  currentProject: DemoProject | null;
}

type Action =
  | { type: 'CREATE_PROJECT'; name: string; videoBlob: Blob; duration: number }
  | { type: 'SET_CURRENT'; id: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<VideoSettings> }
  | { type: 'SET_ANALYSIS'; analysis: AnalysisResult }
  | { type: 'DELETE_PROJECT'; id: string };

const initialState: State = {
  projects: [],
  currentProject: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'CREATE_PROJECT': {
      const project: DemoProject = {
        id: crypto.randomUUID(),
        name: action.name,
        videoBlob: action.videoBlob,
        videoUrl: URL.createObjectURL(action.videoBlob),
        settings: { ...DEFAULT_VIDEO_SETTINGS },
        analysis: null,
        createdAt: Date.now(),
        duration: action.duration,
      };
      return {
        projects: [...state.projects, project],
        currentProject: project,
      };
    }
    case 'SET_CURRENT': {
      const project = state.projects.find((p) => p.id === action.id) || null;
      return { ...state, currentProject: project };
    }
    case 'UPDATE_SETTINGS': {
      if (!state.currentProject) return state;
      const updated = {
        ...state.currentProject,
        settings: { ...state.currentProject.settings, ...action.settings },
      };
      return {
        projects: state.projects.map((p) =>
          p.id === updated.id ? updated : p
        ),
        currentProject: updated,
      };
    }
    case 'SET_ANALYSIS': {
      if (!state.currentProject) return state;
      const updated = {
        ...state.currentProject,
        analysis: action.analysis,
      };
      return {
        projects: state.projects.map((p) =>
          p.id === updated.id ? updated : p
        ),
        currentProject: updated,
      };
    }
    case 'DELETE_PROJECT': {
      const target = state.projects.find((p) => p.id === action.id);
      if (target) URL.revokeObjectURL(target.videoUrl);
      const projects = state.projects.filter((p) => p.id !== action.id);
      return {
        projects,
        currentProject:
          state.currentProject?.id === action.id
            ? null
            : state.currentProject,
      };
    }
    default:
      return state;
  }
}

const DemoContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => {} });

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <DemoContext.Provider value={{ state, dispatch }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
