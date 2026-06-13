import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),

  // Base configuration
  apiUrl: `http://${window.location.hostname}:3000/api`,

  // Simple error/notification system
  notification: null,
  setNotification: (notification) => set({ notification }),
  clearNotification: () => set({ notification: null }),

  // Timeline State
  currentTime: 0,
  setCurrentTime: (time) => set({ currentTime: time }),
  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  // Project state and History
  projectState: { tracks: [], settings: { backgroundColor: '#0F0F0F' } },
  history: [],
  historyIndex: -1,

  setProjectState: (state) => set((get) => {
     const currentHistory = get().history.slice(0, get().historyIndex + 1);
     const newHistory = [...currentHistory, get().projectState];
     // Keep last 50 states
     if (newHistory.length > 50) newHistory.shift();

     return {
       projectState: state,
       history: newHistory,
       historyIndex: newHistory.length - 1
     };
  }),

  undo: () => set((get) => {
    const { history, historyIndex, projectState } = get();
    if (historyIndex < 0) return {}; // Nothing to undo

    const previousState = history[historyIndex];
    // We don't push the current state to history again during undo
    return {
      projectState: previousState,
      historyIndex: historyIndex - 1
    };
  }),

  redo: () => set((get) => {
    const { history, historyIndex, projectState } = get();
    if (historyIndex >= history.length - 1) return {}; // Nothing to redo

    const nextState = history[historyIndex + 1];
    return {
      projectState: nextState,
      historyIndex: historyIndex + 1
    };
  }),

  // Drag and drop state
  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),
  draggedAsset: null,
  setDraggedAsset: (asset) => set({ draggedAsset: asset }),

  // Central playback loop reference
  animationFrameId: null,

  startPlayback: () => {
    if (get().isPlaying) return;
    set({ isPlaying: true });

    let lastTime = performance.now();

    const loop = (time) => {
      const dt = (time - lastTime) / 1000; // Delta time in seconds
      lastTime = time;

      const currentStore = get();
      if (currentStore.isPlaying) {
        set({ currentTime: currentStore.currentTime + dt });
        const id = requestAnimationFrame(loop);
        set({ animationFrameId: id });
      }
    };

    const id = requestAnimationFrame(loop);
    set({ animationFrameId: id });
  },

  stopPlayback: () => {
    set({ isPlaying: false });
    const { animationFrameId } = get();
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      set({ animationFrameId: null });
    }
  }
}));