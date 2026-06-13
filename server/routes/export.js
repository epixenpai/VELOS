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

    const videoTrack = state.tracks.find(t => t.id === 1);
    if (!videoTrack || videoTrack.clips.length === 0) {
      return res.status(400).json({ error: 'No video clips on track 1' });
    }

    const clips = [...videoTrack.clips].sort((a, b) => a.startTime - b.startTime);

    const exportDir = path.join(__dirname, '../../exports', project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase());
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const outputFilename = `export_${Date.now()}.mp4`;
    const outputPath = path.join(exportDir, outputFilename);

    let command = ffmpeg();

    const clipMetadata = await Promise.all(clips.map(async (clip) => {
       const inputPath = path.join(__dirname, '../../', clip.asset.path);
       const hasAudio = await hasAudioStream(inputPath);
       return { clip, inputPath, hasAudio };
    }));

    clipMetadata.forEach(meta => {
      command = command.input(meta.inputPath);
    });

    let filterString = '';

    // Scale, pad, setpts, and trim video streams based on clip properties
    for (let i = 0; i < clipMetadata.length; i++) {
        const { clip } = clipMetadata[i];

        // Trim video (trim filter uses seconds)
        // Set presentation timestamp to match startTime
        const trimFilter = `trim=start=${clip.startOffset || 0}:duration=${clip.duration},setpts=PTS-STARTPTS+${clip.startTime}/TB`;

        // Scale and pad to 1920x1080
        const scalePadFilter = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1`;

        filterString += `[${i}:v]${trimFilter},${scalePadFilter}[v${i}];`;
    }

    // Process audio streams (trim, atrim, delay, dummy generation)
    for (let i = 0; i < clipMetadata.length; i++) {
        const { clip, hasAudio } = clipMetadata[i];

        if (hasAudio) {
            // Trim audio, reset pts, then pad/delay to startTime
            const atrimFilter = `atrim=start=${clip.startOffset || 0}:duration=${clip.duration},asetpts=PTS-STARTPTS,adelay=${clip.startTime * 1000}|${clip.startTime * 1000},aformat=sample_rates=44100:channel_layouts=stereo`;
            filterString += `[${i}:a]${atrimFilter}[a${i}];`;
        } else {
            // Generate dummy audio matching duration, then delay it
            filterString += `anullsrc=r=44100:cl=stereo,atrim=duration=${clip.duration},adelay=${clip.startTime * 1000}|${clip.startTime * 1000}[a${i}];`;
        }
    }

    // Since clips might have gaps, concat filter might not be correct if we used PTS.
    // However, if we're just layering them on a black background, we should use amix for audio
    // But for Phase 1 MVP, if we assume sequential clips with possible gaps, concat works if we pad the gaps,
    // OR we can just use complex overlay mapping.
    // For MVP phase 1, we will keep the standard concatenation but inject black frames for gaps.
    // A much simpler MVP Phase 1 fix is just basic concat without gaps for now,
    // since the user only trims clips to make them shorter. True compositing requires overlay filters which is too complex for basic MP4.

    // Actually, to make trim work with concat:
    // we don't need PTS delay. Concat places them back to back.
    // If the user arranged them back to back, it works.

    // Let's rewrite the filter for simple concat of trimmed clips
    filterString = '';

    for (let i = 0; i < clipMetadata.length; i++) {
        const { clip } = clipMetadata[i];
        const trimFilter = `trim=start=${clip.startOffset || 0}:duration=${clip.duration},setpts=PTS-STARTPTS`;
        const scalePadFilter = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1`;
        filterString += `[${i}:v]${trimFilter},${scalePadFilter}[v${i}];`;

        if (clipMetadata[i].hasAudio) {
            const atrimFilter = `atrim=start=${clip.startOffset || 0}:duration=${clip.duration},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo`;
            filterString += `[${i}:a]${atrimFilter}[a${i}];`;
        } else {
            filterString += `anullsrc=r=44100:cl=stereo,atrim=duration=${clip.duration}[a${i}];`;
        }
    }

    let concatInputs = '';
    for (let i = 0; i < clipMetadata.length; i++) {
        concatInputs += `[v${i}][a${i}]`;
    }
    filterString += `${concatInputs}concat=n=${clipMetadata.length}:v=1:a=1[outv][outa]`;

    command.complexFilter(filterString, ['outv', 'outa'])
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