import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useAppStore } from '../store/appStore';

export default function PreviewCanvas({ width = 1920, height = 1080 }) {
  const containerRef = useRef(null);
  const canvasElRef = useRef(null);
  const canvasRef = useRef(null);

  const { currentTime, projectState, isPlaying } = useAppStore();
  const videoElementsRef = useRef({}); // Cache video elements by clip ID
  const [scale, setScale] = useState(1);

  // Initialize Canvas
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width,
      height,
      backgroundColor: '#000000',
      selection: false, // Turn off selection for Phase 1 basic preview
      preserveObjectStacking: true,
    });

    canvasRef.current = canvas;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: containerWidth, height: containerHeight } = entry.contentRect;
        const scaleX = containerWidth / width;
        const scaleY = containerHeight / height;
        const newScale = Math.min(scaleX, scaleY) * 0.9;

        setScale(newScale);

        const wrapperEl = canvas.wrapperEl;
        if (wrapperEl) {
          wrapperEl.style.transform = `scale(${newScale})`;
          wrapperEl.style.transformOrigin = 'center center';
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      canvas.dispose();
      // Cleanup video elements
      Object.values(videoElementsRef.current).forEach(video => {
        video.pause();
        video.removeAttribute('src');
        video.load();
      });
      videoElementsRef.current = {};
    };
  }, [width, height]);

  // Main Render Loop based on playhead
  useEffect(() => {
    if (!canvasRef.current || !projectState.tracks) return;

    // Find active clip at current time on V1 (Track 1)
    const v1 = projectState.tracks.find(t => t.id === 1);
    if (!v1) return;

    const activeClip = v1.clips.find(
      clip => currentTime >= clip.startTime && currentTime < (clip.startTime + clip.duration)
    );

    canvasRef.current.clear();
    canvasRef.current.backgroundColor = '#000000';

    if (activeClip && activeClip.asset.type === 'video') {
      let videoEl = videoElementsRef.current[activeClip.id];

      // Create video element if it doesn't exist
      if (!videoEl) {
        videoEl = document.createElement('video');
        videoEl.crossOrigin = "anonymous";
        videoEl.src = `http://${window.location.hostname}:3000/${activeClip.asset.path}`;
        videoEl.muted = true; // Preview canvas shouldn't play double audio, handled later
        videoElementsRef.current[activeClip.id] = videoEl;
      }

      // Calculate the local time within the clip
      const localTime = (currentTime - activeClip.startTime) + (activeClip.startOffset || 0);

      // Sync video element time if it drifts or we just jumped
      if (Math.abs(videoEl.currentTime - localTime) > 0.1) {
        videoEl.currentTime = localTime;
      }

      // Handle playback state
      if (isPlaying && videoEl.paused) {
        videoEl.play().catch(e => console.log("Play interrupted", e));
      } else if (!isPlaying && !videoEl.paused) {
        videoEl.pause();
      }

      // Create fabric Image from video element
      const fabricImage = new fabric.Image(videoEl, {
        left: width / 2,
        top: height / 2,
        originX: 'center',
        originY: 'center',
        objectCaching: false, // Important for video
      });

      // Scale to fit (Phase 1 simple scaling)
      const scaleX = width / videoEl.videoWidth || 1;
      const scaleY = height / videoEl.videoHeight || 1;
      const vScale = Math.min(scaleX, scaleY);

      if (!isNaN(vScale) && vScale !== Infinity && vScale > 0) {
          fabricImage.scale(vScale);
      }

      canvasRef.current.add(fabricImage);
    } else {
        // Pause all videos if no active clip
        Object.values(videoElementsRef.current).forEach(video => {
            if (!video.paused) video.pause();
        });
    }

    canvasRef.current.renderAll();

  }, [currentTime, projectState, isPlaying, width, height]);

  // Request Animation Frame loop for continuous rendering when playing
  useEffect(() => {
    let animationFrameId;

    const renderLoop = () => {
      if (isPlaying && canvasRef.current) {
         canvasRef.current.renderAll();
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center relative overflow-hidden">
      <div className="absolute flex items-center justify-center shadow-2xl">
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}