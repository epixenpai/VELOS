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
    <div ref={setNodeRef} className="h-20 bg-gray-900 border-b border-gray-800 relative mb-1 flex items-center">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gray-950 border-r border-gray-800 flex items-center justify-center text-xs font-semibold text-gray-500 z-10 pointer-events-none">
        V{id}
      </div>

      <div className="absolute left-16 right-0 top-0 bottom-0 overflow-hidden">
        {clips.map(clip => {
          let displayClip = clip;
          if (draggingClip && draggingClip.id === clip.id) displayClip = draggingClip;
          if (trimmingClip && trimmingClip.clip.id === clip.id) displayClip = trimmingClip.clip;

          return (
            <div
              key={clip.id}
              onMouseDown={(e) => handleClipMouseDown(e, clip)}
              className="absolute top-1 bottom-1 bg-velos-primary/80 border border-velos-primary rounded-sm flex items-center text-xs overflow-hidden cursor-move select-none group"
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
        tracks: [{ id: 1, type: 'video', clips: [] }]
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
    const x = e.clientX - rect.left - 64 + timelineRef.current.scrollLeft;
    if (x >= 0) setCurrentTime(x / PIXELS_PER_SECOND);
  };

  const handleRulerDrag = (e) => {
     if (e.buttons !== 1) return;
     handleRulerClick(e);
  }

  return (
      <div className="h-full flex flex-col select-none">
        <div className="h-10 border-b border-gray-800 bg-gray-950 flex items-center px-4 justify-between shrink-0">
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
          className="flex-1 relative overflow-auto bg-gray-950"
          ref={timelineRef}
        >
          <div
             className="h-6 border-b border-gray-800 ml-16 relative bg-gray-900 overflow-hidden cursor-text"
             onMouseDown={handleRulerClick}
             onMouseMove={handleRulerDrag}
          >
            {[...Array(60)].map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-gray-700 text-[10px] text-gray-500 pl-1 pointer-events-none"
                style={{ left: `${i * PIXELS_PER_SECOND}px` }}
              >
                00:{i.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          <div className="relative">
            <div
              className="absolute top-0 bottom-0 w-px bg-red-500 z-40 pointer-events-none"
              style={{ left: `${64 + (currentTime * PIXELS_PER_SECOND)}px` }}
            >
              <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 absolute -top-[8px] -left-[5px]"></div>
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