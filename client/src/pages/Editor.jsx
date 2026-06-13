import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import AssetManager from '../components/AssetManager';
import { Settings, Download, ChevronLeft } from 'lucide-react';
import Timeline from '../components/Timeline';
import { DndContext } from '@dnd-kit/core';
import PreviewCanvas from '../components/PreviewCanvas';

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apiUrl } = useAppStore();
  const [project, setProject] = useState(null);

  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Ensure we save the latest timeline state first
      await fetch(`${apiUrl}/projects/${id}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: useAppStore.getState().projectState })
      });

      const res = await fetch(`${apiUrl}/export/${id}/export`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert('Export started! Check server logs for progress.\n\nURL will be available at: ' + data.statusUrl);
      } else {
        alert('Export failed: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Export request failed.');
    } finally {
      setIsExporting(false);
    }
  };


  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`${apiUrl}/projects/${id}`);
        if (!res.ok) throw new Error('Project not found');
        const data = await res.json();
        setProject(data);
      } catch (err) {
        console.error(err);
        navigate('/'); // Redirect to home if project doesn't exist
      }
    };

    fetchProject();
  }, [id, apiUrl, navigate]);

  if (!project) return <div className="h-screen bg-velos-dark flex items-center justify-center text-white">Loading...</div>;


  const handleDragEnd = (event) => {
    const { over, active } = event;
    const { projectState, setProjectState, currentTime } = useAppStore.getState();

    if (over && over.id.toString().startsWith('track-')) {
      const trackId = parseInt(over.id.toString().replace('track-', ''));
      const asset = active.data.current?.asset;

      if (asset) {
        let dropTime = currentTime;
        const track = projectState.tracks.find(t => t.id === trackId);
        if (track && track.clips.length > 0) {
           const lastClip = track.clips.reduce((prev, current) => (prev.startTime + prev.duration > current.startTime + current.duration) ? prev : current);
           dropTime = lastClip.startTime + lastClip.duration;
        }

        const newTracks = projectState.tracks.map(track => {
          if (track.id === trackId) {
            return {
              ...track,
              clips: [...track.clips, {
                id: crypto.randomUUID(),
                asset,
                startTime: dropTime,
                duration: 5,
                startOffset: 0
              }]
            };
          }
          return track;
        });

        setProjectState({ ...projectState, tracks: newTracks });
      }
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
    <div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden">
      {/* Topbar */}
      <header className="h-14 border-b border-gray-800 bg-velos-dark flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="font-semibold">{project.name}</div>
        </div>

        <div className="flex items-center gap-3">
          <button className="text-gray-400 hover:text-white p-2">
            <Settings size={18} />
          </button>
          <button onClick={handleExport} disabled={isExporting} className="bg-velos-primary hover:bg-blue-600 px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
            <Download size={16} />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Asset Manager */}
        <AssetManager />

        {/* Center Panel - Canvas & Properties */}
        <div className="flex-1 flex flex-col min-w-0 bg-black">
          {/* Canvas Area */}
          <div className="flex-1 p-4 flex items-center justify-center relative bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAACtJREFUeNpi/P//PwM1ARMDlcGogcSDGRkZkGwxwKxIHDXwUANJMwEgwAAgKwKxS8p0pQAAAABJRU5ErkJggg==')]">
            <div className="w-full h-full border border-gray-800 bg-black shadow-2xl flex items-center justify-center text-gray-600">
              <PreviewCanvas />
            </div>
          </div>

{/* Properties Area */}
          <div className="h-48 border-t border-gray-800 bg-gray-900 p-4 hidden md:block overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-400 mb-4">Properties</h3>
            {useAppStore.getState().selectedClipId ? (
              <div className="flex flex-col gap-4">
                 <div>
                    <label className="text-xs text-gray-500 block mb-1">Transition (Fade)</label>
                    <select
                       className="bg-black border border-gray-700 text-white text-xs rounded px-2 py-1"
                       onChange={(e) => {
                          const store = useAppStore.getState();
                          const newTracks = store.projectState.tracks.map(t => ({
                             ...t, clips: t.clips.map(c => c.id === store.selectedClipId ? { ...c, transition: e.target.value } : c)
                          }));
                          store.setProjectState({ ...store.projectState, tracks: newTracks });
                       }}
                    >
                       <option value="">None</option>
                       <option value="fade">Fade In/Out</option>
                    </select>
                 </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                 <div>
                    <label className="text-xs text-gray-500 block mb-1">Canvas Background</label>
                    <input
                       type="color"
                       className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                       value={useAppStore.getState().projectState?.settings?.backgroundColor || '#0F0F0F'}
                       onChange={(e) => {
                          const store = useAppStore.getState();
                          store.setProjectState({
                             ...store.projectState,
                             settings: { ...store.projectState.settings, backgroundColor: e.target.value }
                          });
                       }}
                    />
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Area */}
      <div className="h-64 border-t border-gray-800 bg-gray-900 shrink-0 flex flex-col">
        <div className="h-8 border-b border-gray-800 bg-gray-950 flex items-center px-4 gap-4 text-xs text-gray-400">
          <div>Timeline Controls</div>
        </div>
        <div className="flex-1 relative overflow-auto p-4">
          <Timeline />
        </div>
      </div>
    </div>
    </DndContext>
  );
}