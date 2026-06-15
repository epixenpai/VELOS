import { create } from 'zustand';
import { io } from 'socket.io-client';

const socket = io(`http://${window.location.hostname}:3000`);

export const useAppStore = create((set, get) => {
  socket.on('timeline-sync', (newState) => {
      if (JSON.stringify(get().projectState) !== JSON.stringify(newState)) {
          set({ projectState: newState });
      }
  });

  return {
    projects: [],
    setProjects: (projects) => set({ projects }),

    apiUrl: `http://${window.location.hostname}:3000/api`,

    notification: null,
    setNotification: (notification) => set({ notification }),
    clearNotification: () => set({ notification: null }),

    currentTime: 0,
    setCurrentTime: (time) => set({ currentTime: time }),
    isPlaying: false,
    setIsPlaying: (playing) => set({ isPlaying: playing }),

    projectState: { tracks: [], settings: { backgroundColor: '#0F0F0F' } },
    history: [],
    historyIndex: -1,

    setProjectState: (newState) => set((state) => {
       socket.emit('timeline-update', { projectId: 'global', state: newState });

       const currentHistory = state.history.slice(0, state.historyIndex + 1);
       const newHistory = [...currentHistory, state.projectState];
       if (newHistory.length > 50) newHistory.shift();

       return {
         projectState: newState,
         history: newHistory,
         historyIndex: newHistory.length - 1
       };
    }),

    undo: () => set((state) => {
      const { history, historyIndex, projectState } = state;
      if (historyIndex < 0) return {};

      const previousState = history[historyIndex];
      socket.emit('timeline-update', { projectId: 'global', state: previousState });

      return {
        projectState: previousState,
        historyIndex: historyIndex - 1
      };
    }),

    redo: () => set((state) => {
      const { history, historyIndex, projectState } = state;
      if (historyIndex >= history.length - 1) return {};

      const nextState = history[historyIndex + 1];
      socket.emit('timeline-update', { projectId: 'global', state: nextState });

      return {
        projectState: nextState,
        historyIndex: historyIndex + 1
      };
    }),

    selectedClipId: null,
    setSelectedClipId: (id) => set({ selectedClipId: id }),
    draggedAsset: null,
    setDraggedAsset: (asset) => set({ draggedAsset: asset }),

    animationFrameId: null,

    startPlayback: () => {
      if (get().isPlaying) return;
      set({ isPlaying: true });

      let lastTime = performance.now();

      const loop = (time) => {
        const dt = (time - lastTime) / 1000;
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
  };
});