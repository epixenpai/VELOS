import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Play, Pause, Scissors, CornerUpLeft, CornerUpRight } from 'lucide-react';

const PIXELS_PER_SECOND = 100;

function DraggableAsset({ asset, children }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `asset-${asset.id}`,
    data: { type: 'asset', asset },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

function Track({ id, clips, onDrop, updateClipPosition, updateClipDuration }) {
  const { setNodeRef } = useDroppable({
    id: `track-${id}`,
  });

  const [draggingClip, setDraggingClip] = useState(null);
  const [trimmingClip, setTrimmingClip] = useState(null); // { clip, side: 'left' | 'right' }

  // Dragging entire clip
  const handleClipMouseDown = (e, clip) => {
    e.stopPropagation();
    // If we're clicking near edges, don't drag the clip, we want to trim
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < 10 || x > rect.width - 10) return;

    const startX = e.clientX;
    const startStartTime = clip.startTime;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / PIXELS_PER_SECOND;
      let newStartTime = startStartTime + deltaTime;
      if (newStartTime < 0) newStartTime = 0;

      setDraggingClip({ ...clip, startTime: newStartTime });
    };

    const handleMouseUp = (upEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const deltaX = upEvent.clientX - startX;
      const deltaTime = deltaX / PIXELS_PER_SECOND;
      let newStartTime = startStartTime + deltaTime;
      if (newStartTime < 0) newStartTime = 0;

      updateClipPosition(id, clip.id, newStartTime);
      setDraggingClip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Trimming clip edges
  const handleTrimMouseDown = (e, clip, side) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startStartTime = clip.startTime;
    const startDuration = clip.duration;
    const startOffset = clip.startOffset || 0;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / PIXELS_PER_SECOND;

      let newClip = { ...clip };
      if (side === 'left') {
        const timeChange = Math.min(deltaTime, startDuration - 0.5); // min 0.5s duration
        newClip.startTime = Math.max(0, startStartTime + timeChange);
        newClip.duration = startDuration - timeChange;
        newClip.startOffset = Math.max(0, startOffset + timeChange);
      } else {
        const timeChange = Math.max(deltaTime, -(startDuration - 0.5));
        newClip.duration = startDuration + timeChange;
      }
      setTrimmingClip({ clip: newClip, side });
    };

    const handleMouseUp = (upEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const deltaX = upEvent.clientX - startX;
      const deltaTime = deltaX / PIXELS_PER_SECOND;

      let newStartTime = startStartTime;
      let newDuration = startDuration;
      let newStartOffset = startOffset;

      if (side === 'left') {
        const timeChange = Math.min(deltaTime, startDuration - 0.5);
        newStartTime = Math.max(0, startStartTime + timeChange);
        newDuration = startDuration - timeChange;
        newStartOffset = Math.max(0, startOffset + timeChange);
      } else {
        const timeChange = Math.max(deltaTime, -(startDuration - 0.5));
        newDuration = startDuration + timeChange;
      }

      updateClipDuration(id, clip.id, newStartTime, newDuration, newStartOffset);
      setTrimmingClip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div ref={setNodeRef} className="h-24 bg-velos-dark border-b border-velos-border relative flex items-center group">
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-velos-panel border-r border-velos-border flex flex-col items-center justify-center text-xs font-bold text-gray-500 z-10 pointer-events-none shadow-[5px_0_15px_rgba(0,0,0,0.2)] gap-1">
        {id}
      </div>

      <div className="absolute left-16 right-0 top-0 bottom-0 overflow-hidden">
        {clips.map(clip => {
          let displayClip = clip;
          if (draggingClip && draggingClip.id === clip.id) displayClip = draggingClip;
          if (trimmingClip && trimmingClip.clip.id === clip.id) displayClip = trimmingClip.clip;

          let bgClass = 'bg-velos-primary/80 border-velos-primary';
          if (clip.asset.type === 'audio') bgClass = 'bg-emerald-600/80 border-emerald-500';
          if (clip.asset.type === 'text') bgClass = 'bg-purple-600/80 border-purple-500';
          if (clip.asset.type === 'shape') bgClass = 'bg-orange-600/80 border-orange-500';

          const isSelected = useAppStore.getState().selectedClipId === clip.id;
          if (isSelected) bgClass = 'bg-velos-secondary/90 border-velos-secondary shadow-[0_0_15px_rgba(245,197,24,0.3)] z-30';


          return (
            <div
              key={clip.id}
              onClick={() => useAppStore.getState().setSelectedClipId(clip.id)}
              onMouseDown={(e) => handleClipMouseDown(e, clip)}
              className={`absolute top-2 bottom-2 ${bgClass} border rounded-md flex items-center text-[11px] font-medium text-white overflow-hidden cursor-move select-none group transition-shadow`}
              style={{
                left: `${displayClip.startTime * PIXELS_PER_SECOND}px`,
                width: `${displayClip.duration * PIXELS_PER_SECOND}px`
              }}
            >
               {/* Left Trim Handle */}
               <div
                 onMouseDown={(e) => handleTrimMouseDown(e, clip, 'left')}
                 className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 z-20"
               />
               <span className="truncate px-2 flex-1 pointer-events-none">{displayClip.asset.name}</span>
               {/* Audio Volume Indicator/Control (Basic MVP implementation) */}
               {displayClip.asset.type === 'audio' && (
                 <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500/50" style={{ height: `${(displayClip.volume !== undefined ? displayClip.volume : 1) * 100}%` }} />
               )}
               {/* Right Trim Handle */}
               <div
                 onMouseDown={(e) => handleTrimMouseDown(e, clip, 'right')}
                 className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50 z-20"
               />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Timeline() {
  const {
    currentTime, setCurrentTime,
    isPlaying, startPlayback, stopPlayback,
    projectState, setProjectState
  } = useAppStore();

  const timelineRef = useRef(null);

  useEffect(() => {
    if (!projectState.tracks || projectState.tracks.length === 0) {
      setProjectState({
        ...projectState,
        tracks: [
        { id: 'V3', type: 'video', clips: [] },
        { id: 'V2', type: 'video', clips: [] },
        { id: 'V1', type: 'video', clips: [] },
        { id: 'A1', type: 'audio', clips: [] },
        { id: 'A2', type: 'audio', clips: [] }
      ]
      });
    }
  }, [projectState, setProjectState]);

  const updateClipPosition = useCallback((trackId, clipId, newStartTime) => {
    const newTracks = projectState.tracks.map(track => {
      if (track.id === trackId) {
        return {
          ...track,
          clips: track.clips.map(clip =>
            clip.id === clipId ? { ...clip, startTime: newStartTime } : clip
          )
        };
      }
      return track;
    });
    setProjectState({ ...projectState, tracks: newTracks });
  }, [projectState, setProjectState]);

  const updateClipDuration = useCallback((trackId, clipId, newStartTime, newDuration, newStartOffset) => {
    const newTracks = projectState.tracks.map(track => {
      if (track.id === trackId) {
        return {
          ...track,
          clips: track.clips.map(clip =>
            clip.id === clipId ? { ...clip, startTime: newStartTime, duration: newDuration, startOffset: newStartOffset } : clip
          )
        };
      }
      return track;
    });
    setProjectState({ ...projectState, tracks: newTracks });
  }, [projectState, setProjectState]);

  const togglePlay = () => {
    if (isPlaying) stopPlayback();
    else startPlayback();
  };

  const handleRulerClick = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 80 + timelineRef.current.scrollLeft;
    if (x >= 0) setCurrentTime(x / PIXELS_PER_SECOND);
  };

  const handleRulerDrag = (e) => {
     if (e.buttons !== 1) return;
     handleRulerClick(e);
  }

  return (
      <div className="h-full flex flex-col select-none">
        <div className="h-12 border-b border-velos-border bg-velos-darker flex items-center px-6 justify-between shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors">
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <div className="w-px h-4 bg-gray-700 mx-2"></div>
            <button className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <CornerUpLeft size={16} />
            </button>
            <button className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <CornerUpRight size={16} />
            </button>
            <button className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <Scissors size={16} />
            </button>
          </div>

          <div className="font-mono text-xs text-velos-primary">
            {new Date(Math.max(0, currentTime) * 1000).toISOString().substr(14, 8)}
          </div>
        </div>

        <div
          className="flex-1 relative overflow-auto bg-velos-darker no-scrollbar"
          ref={timelineRef}
        >
          <div
             className="h-7 border-b border-velos-border ml-20 relative bg-velos-panel overflow-hidden cursor-text shadow-sm"
             onMouseDown={handleRulerClick}
             onMouseMove={handleRulerDrag}
          >
            {[...Array(60)].map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-gray-700/50 text-[10px] text-gray-500 pl-1.5 pt-1 pointer-events-none font-mono"
                style={{ left: `${i * PIXELS_PER_SECOND}px` }}
              >
                00:{i.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

<div className="relative">
            <div
              className="absolute top-0 bottom-0 w-[1.5px] bg-velos-primary z-40 pointer-events-none shadow-[0_0_10px_rgba(45,111,255,0.5)]"
              style={{ left: `${80 + (currentTime * PIXELS_PER_SECOND)}px` }}
            >
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-velos-primary absolute -top-[10px] -left-[5px]"></div>
            </div>

            {projectState.tracks?.map(track => (
              <Track
                key={track.id}
                id={track.id}
                clips={track.clips}
                updateClipPosition={updateClipPosition}
                updateClipDuration={updateClipDuration}
              />
            ))}
          </div>
        </div>
      </div>
  );
}

export { DraggableAsset };
