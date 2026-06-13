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

  // Project state
  projectState: { tracks: [] },
  setProjectState: (state) => set({ projectState: state }),

  // Drag and drop state
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