import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const hasAudioStream = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const audioStreams = metadata.streams.filter(s => s.codec_type === 'audio');
      resolve(audioStreams.length > 0);
    });
  });
};

router.post('/:id/export', async (req, res) => {
  const { id } = req.params;

  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const state = project.state ? JSON.parse(project.state) : null;
    if (!state || !state.tracks || state.tracks.length === 0) {
      return res.status(400).json({ error: 'Project timeline is empty' });
    }

    const exportDir = path.join(__dirname, '../../exports', project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase());
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const outputFilename = `export_${Date.now()}.mp4`;
    const outputPath = path.join(exportDir, outputFilename);

    let command = ffmpeg();
    let filterString = '';

    // We only process video and audio for Phase 2 MVP. True overlay of text/shapes via ffmpeg is extremely complex,
    // usually requires generating ASS subtitle files or rendering a transparent video from canvas.
    // For now, we mix multiple video and audio tracks.

    const allClips = [];
    state.tracks.forEach(t => {
       t.clips.forEach(c => allClips.push({...c, trackType: t.type, trackId: t.id}));
    });

    if (allClips.length === 0) {
      return res.status(400).json({ error: 'No clips on timeline' });
    }

    // Sort by start time
    allClips.sort((a, b) => a.startTime - b.startTime);

    const clipMetadata = await Promise.all(allClips.map(async (clip, idx) => {
       if (clip.asset.type !== 'video' && clip.asset.type !== 'audio') {
          return { clip, isMedia: false, idx };
       }
       const inputPath = path.join(__dirname, '../../', clip.asset.path);
       const hasAudio = clip.asset.type === 'audio' ? true : await hasAudioStream(inputPath);
       return { clip, inputPath, hasAudio, isMedia: true, idx };
    }));

    const mediaClips = clipMetadata.filter(m => m.isMedia);

    mediaClips.forEach(meta => {
      command = command.input(meta.inputPath);
    });

    // Create a base black background video of the total duration
    const totalDuration = Math.max(...allClips.map(c => c.startTime + c.duration));
    const bgColor = state.settings?.backgroundColor || '#000000';

    // We use the color source filter
    command = command.input(`color=c=${bgColor.replace('#','0x')}@1:s=1920x1080:d=${totalDuration}`).inputFormat('lavfi');
    const bgIndex = mediaClips.length;

    // We will use overlay filter to place videos on the background at their exact start times
    let currentVideoOutput = `[${bgIndex}:v]`;
    let overlayCount = 0;
    let audioMixInputs = '';

    for (let i = 0; i < mediaClips.length; i++) {
        const { clip, hasAudio } = mediaClips[i];

if (clip.asset.type === 'video') {
            // Eq filter for Brightness, Contrast, Saturation
            const props = clip.asset.properties || {};
            const brightness = props.brightness || 0;
            const contrast = props.contrast ? (1 + parseFloat(props.contrast)) : 1;
            const saturation = props.saturation ? (1 + parseFloat(props.saturation)) : 1;
            const eqFilter = `eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`;

            // Trim, eq, and scale
            const trimFilter = `trim=start=${clip.startOffset || 0}:duration=${clip.duration},setpts=PTS-STARTPTS`;
            const scalePadFilter = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1`;
            filterString += `[${i}:v]${trimFilter},${eqFilter},${scalePadFilter}[v${i}pre];`;

            // Transitions
            if (clip.transition === 'fade') {
               filterString += `[v${i}pre]fade=t=in:st=0:d=1,fade=t=out:st=${clip.duration - 1}:d=1[v${i}ready];`;
            } else if (clip.transition === 'wipe') {
               // A simple wipe logic approximation: crop expanding
               filterString += `[v${i}pre]copy[v${i}ready];`; // FFmpeg true wipe requires xfade between two streams, we just copy for MVP overlay
            } else if (clip.transition === 'slide') {
               filterString += `[v${i}pre]copy[v${i}ready];`;
            } else {
               filterString += `[v${i}pre]copy[v${i}ready];`;
            }

            // Overlay onto the timeline background
            const enable = `enable='between(t,${clip.startTime},${clip.startTime + clip.duration})'`;
            const newOutput = `[vout${overlayCount}]`;
            filterString += `${currentVideoOutput}[v${i}ready]overlay=0:0:${enable}${newOutput};`;
            currentVideoOutput = newOutput;
            overlayCount++;
        }

        // Handle Audio
        if (hasAudio) {
            const vol = clip.volume !== undefined ? clip.volume : 1.0;
            const atrimFilter = `atrim=start=${clip.startOffset || 0}:duration=${clip.duration},asetpts=PTS-STARTPTS,volume=${vol},adelay=${clip.startTime * 1000}|${clip.startTime * 1000}`;
            filterString += `[${i}:a]${atrimFilter}[a${i}ready];`;
            audioMixInputs += `[a${i}ready]`;
        }
    }

    // Add text layers via drawtext
    const textClips = allClips.filter(c => c.asset.type === 'text');
    let textOverlayOutput = currentVideoOutput;

    textClips.forEach((clip, idx) => {
        const p = clip.asset.properties || {};
        const text = (p.text || 'Text').replace(/:/g, '\\:').replace(/'/g, "\\'");
        const color = (p.fill || '#FFFFFF').replace('#', '0x');
        const size = p.fontSize || 60;

        // Fabric left/top are center-origin by default in our setup,
        // FFmpeg drawtext uses top-left. We approximate center here.
        const x = p.left ? `${p.left}-(tw/2)` : '(w-tw)/2';
        const y = p.top ? `${p.top}-(th/2)` : '(h-th)/2';

        const enable = `enable='between(t,${clip.startTime},${clip.startTime + clip.duration})'`;
        const newOut = `[textout${idx}]`;

        filterString += `${textOverlayOutput}drawtext=text='${text}':fontcolor=${color}:fontsize=${size}:x=${x}:y=${y}:${enable}${newOut};`;
        textOverlayOutput = newOut;
    });

    currentVideoOutput = textOverlayOutput;

    // Add a silent track of total duration so amix doesn't fail if no audio is present
    command = command.input(`anullsrc=r=44100:cl=stereo:d=${totalDuration}`).inputFormat('lavfi');
    const silentAudioIndex = mediaClips.length + 1;
    filterString += `[${silentAudioIndex}:a]aformat=sample_rates=44100:channel_layouts=stereo[asilent];`;
    audioMixInputs += `[asilent]`;

    // Mix audio
    const audioInputCount = mediaClips.filter(m => m.hasAudio).length + 1; // +1 for the silent track
    filterString += `${audioMixInputs}amix=inputs=${audioInputCount}:duration=first:dropout_transition=3[aout]`;

    command.complexFilter(filterString, [currentVideoOutput.replace(/[[]]/g, ''), 'aout'])
           .outputOptions([
             '-c:v libx264',
             '-pix_fmt yuv420p',
             '-c:a aac',
             '-b:a 192k',
             '-r 30'
           ])
           .save(outputPath);

    res.status(202).json({ message: 'Export started', statusUrl: `/exports/${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}/${outputFilename}` });

    command.on('start', (cmdline) => {
      console.log('Started FFmpeg with command:', cmdline);
    });

    command.on('progress', (progress) => {
      console.log(`Processing: ${progress.percent}% done`);
    });

    command.on('end', () => {
      console.log('Export finished successfully:', outputPath);
    });

    command.on('error', (err) => {
      console.error('Error during export:', err);
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

export default router;