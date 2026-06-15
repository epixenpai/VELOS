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
      selection: true,
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

    // Handle object modified
    canvas.on('object:modified', (e) => {
      const obj = e.target;
      if (!obj || !obj.clipId) return;

      const store = useAppStore.getState();
      const newTracks = store.projectState.tracks.map(t => {
         return {
            ...t,
            clips: t.clips.map(c => {
               if (c.id === obj.clipId) {
                  return {
                     ...c,
                     asset: {
                        ...c.asset,
                        properties: {
                           ...c.asset.properties,
                           left: obj.left,
                           top: obj.top,
                           scaleX: obj.scaleX,
                           scaleY: obj.scaleY,
                           angle: obj.angle,
                           width: obj.width * obj.scaleX,
                           height: obj.height * obj.scaleY,
                        }
                     }
                  }
               }
               return c;
            })
         }
      });
      store.setProjectState({ ...store.projectState, tracks: newTracks });
    });

    canvas.on('selection:created', (e) => {
       if (e.selected && e.selected.length > 0 && e.selected[0].clipId) {
           useAppStore.getState().setSelectedClipId(e.selected[0].clipId);
       }
    });

    return () => {
      resizeObserver.disconnect();
      canvas.dispose();
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

    canvasRef.current.clear();
    canvasRef.current.backgroundColor = projectState.settings?.backgroundColor || '#000000';

    // Video tracks: V1 is bottom layer, V2 above it, V3 on top
    // The tracks array might be [V3, V2, V1], so we reverse it to render V1 first
    const videoTracks = projectState.tracks.filter(t => t.type === 'video').reverse();

    // We only want to play videos that are active
    const currentActiveVideoIds = new Set();

    videoTracks.forEach(track => {
      const activeClip = track.clips.find(
        clip => currentTime >= clip.startTime && currentTime < (clip.startTime + clip.duration)
      );

if (activeClip && activeClip.asset.type === 'video') {
        currentActiveVideoIds.add(activeClip.id);
        let videoEl = videoElementsRef.current[activeClip.id];

        if (!videoEl) {
          videoEl = document.createElement('video');
          videoEl.crossOrigin = "anonymous";
          videoEl.src = `http://${window.location.hostname}:3000/${activeClip.asset.path}`;
          videoEl.muted = true;
          videoElementsRef.current[activeClip.id] = videoEl;
        }

        const localTime = (currentTime - activeClip.startTime) + (activeClip.startOffset || 0);

        if (Math.abs(videoEl.currentTime - localTime) > 0.1) {
          videoEl.currentTime = localTime;
        }

        if (isPlaying && videoEl.paused) {
          videoEl.play().catch(e => console.log("Play interrupted", e));
        } else if (!isPlaying && !videoEl.paused) {
          videoEl.pause();
        }

let opacity = 1;
        const transitionDuration = activeClip.transitionDuration || 1; // 1 second default transition

        // Basic Fade In (Dip to Black/Dissolve equivalent for MVP)
        if (activeClip.transition === 'fade') {
           const timeInClip = currentTime - activeClip.startTime;
           if (timeInClip < transitionDuration) {
              opacity = timeInClip / transitionDuration;
           } else {
              const timeFromEnd = (activeClip.startTime + activeClip.duration) - currentTime;
              if (timeFromEnd < transitionDuration) {
                 opacity = timeFromEnd / transitionDuration;
              }
           }
        }

        const fabricImage = new fabric.Image(videoEl, {
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          opacity: opacity,
          objectCaching: false,
          clipId: activeClip.id,
        });

        const scaleX = width / videoEl.videoWidth || 1;
        const scaleY = height / videoEl.videoHeight || 1;
        const vScale = Math.min(scaleX, scaleY);

if (!isNaN(vScale) && vScale !== Infinity && vScale > 0) {
            fabricImage.scale(vScale);
        }

        // Apply visual effects if properties exist
        if (activeClip.asset.properties) {
           const p = activeClip.asset.properties;
           const filters = [];
           if (p.brightness) filters.push(new fabric.Image.filters.Brightness({ brightness: parseFloat(p.brightness) }));
           if (p.contrast) filters.push(new fabric.Image.filters.Contrast({ contrast: parseFloat(p.contrast) }));
           if (p.saturation) filters.push(new fabric.Image.filters.Saturation({ saturation: parseFloat(p.saturation) }));
           if (p.blur) filters.push(new fabric.Image.filters.Blur({ blur: parseFloat(p.blur) }));
           if (p.noise) filters.push(new fabric.Image.filters.Noise({ noise: parseInt(p.noise, 10) }));

           if (filters.length > 0) {
              fabricImage.filters = filters;
              fabricImage.applyFilters();
           }
        }

        canvasRef.current.add(fabricImage);
      } else if (activeClip && activeClip.asset.type === 'text') {
        const textProperties = activeClip.asset.properties || {};
        const textObj = new fabric.Text(textProperties.text || 'New Text', {
          clipId: activeClip.id,
          left: textProperties.left || width / 2,
          top: textProperties.top || height / 2,
          scaleX: textProperties.scaleX || 1,
          scaleY: textProperties.scaleY || 1,
          angle: textProperties.angle || 0,
          originX: 'center',
          originY: 'center',
          fill: textProperties.fill || '#FFFFFF',
          fontSize: textProperties.fontSize || 60,
          fontFamily: textProperties.fontFamily || 'sans-serif',
          fontWeight: textProperties.fontWeight || 'normal',
          textAlign: textProperties.textAlign || 'center',
        });
        canvasRef.current.add(textObj);
      } else if (activeClip && activeClip.asset.type === 'shape') {
        const shapeProperties = activeClip.asset.properties || {};
        let shapeObj;

        const commonProps = {
          clipId: activeClip.id,
          left: shapeProperties.left || width / 2,
          top: shapeProperties.top || height / 2,
          scaleX: shapeProperties.scaleX || 1,
          scaleY: shapeProperties.scaleY || 1,
          angle: shapeProperties.angle || 0,
          originX: 'center',
          originY: 'center',
          fill: shapeProperties.fill || '#2D6FFF',
          width: shapeProperties.width || 200,
          height: shapeProperties.height || 200,
        };

        if (shapeProperties.shapeType === 'circle') {
           shapeObj = new fabric.Circle({ ...commonProps, radius: commonProps.width / 2 });
        } else {
           shapeObj = new fabric.Rect({ ...commonProps, rx: shapeProperties.rx || 0, ry: shapeProperties.ry || 0 });
        }

        canvasRef.current.add(shapeObj);
      } else if (activeClip && activeClip.asset.type === 'image') {
          // Add image support
      }
    });

    // Audio mixing for audio tracks
    const audioTracks = projectState.tracks.filter(t => t.type === 'audio');

    audioTracks.forEach(track => {
      const activeClip = track.clips.find(
        clip => currentTime >= clip.startTime && currentTime < (clip.startTime + clip.duration)
      );

      if (activeClip && activeClip.asset.type === 'audio') {
        currentActiveVideoIds.add(activeClip.id); // Reusing the set to track active audio elements too
        let audioEl = videoElementsRef.current[activeClip.id];

        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.crossOrigin = "anonymous";
          audioEl.src = `http://${window.location.hostname}:3000/${activeClip.asset.path}`;
          videoElementsRef.current[activeClip.id] = audioEl;
        }

        const localTime = (currentTime - activeClip.startTime) + (activeClip.startOffset || 0);

        if (Math.abs(audioEl.currentTime - localTime) > 0.1) {
          audioEl.currentTime = localTime;
        }

        audioEl.volume = activeClip.volume !== undefined ? activeClip.volume : 1.0;

        if (isPlaying && audioEl.paused) {
          audioEl.play().catch(e => console.log("Play interrupted", e));
        } else if (!isPlaying && !audioEl.paused) {
          audioEl.pause();
        }
      }
    });

    // Pause all videos/audios not currently active
    Object.keys(videoElementsRef.current).forEach(id => {
      if (!currentActiveVideoIds.has(id)) {
         const video = videoElementsRef.current[id];
         if (!video.paused) video.pause();
      }
    });

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