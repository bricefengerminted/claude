import { createContext, useContext, useReducer, ReactNode } from 'react'
import {
  DemoProject,
  RRWebEvent,
  EnhancementSettings,
  DEFAULT_SETTINGS,
} from '../types'

interface State {
  projects: DemoProject[];
  currentProject: DemoProject | null;
}

type Action =
  | { type: 'CREATE_PROJECT'; name: string; events: RRWebEvent[] }
  | { type: 'SET_CURRENT'; id: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<EnhancementSettings> }
  | { type: 'SET_ENHANCED_EVENTS'; events: RRWebEvent[] }
  | { type: 'DELETE_PROJECT'; id: string };

const initialState: State = {
  projects: [],
  currentProject: null,
};

function computeDuration(events: RRWebEvent[]): number {
  if (events.length < 2) return 0;
  return events[events.length - 1].timestamp - events[0].timestamp;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'CREATE_PROJECT': {
      const project: DemoProject = {
        id: crypto.randomUUID(),
        name: action.name,
        rawEvents: action.events,
        enhancedEvents: null,
        settings: { ...DEFAULT_SETTINGS },
        createdAt: Date.now(),
        duration: computeDuration(action.events),
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
        enhancedEvents: null, // invalidate on settings change
      };
      return {
        projects: state.projects.map((p) =>
          p.id === updated.id ? updated : p
        ),
        currentProject: updated,
      };
    }
    case 'SET_ENHANCED_EVENTS': {
      if (!state.currentProject) return state;
      const updated = {
        ...state.currentProject,
        enhancedEvents: action.events,
        duration: computeDuration(action.events),
      };
      return {
        projects: state.projects.map((p) =>
          p.id === updated.id ? updated : p
        ),
        currentProject: updated,
      };
    }
    case 'DELETE_PROJECT': {
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
