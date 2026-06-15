# VELOS — Web-Based Video Editing OS

## Prerequisites

### Node.js
Ensure you have Node.js installed (v18 or higher recommended).

### FFmpeg
Velos relies heavily on FFmpeg for video processing and exporting. You must have FFmpeg installed on your host machine.

**Windows Installation:**
1. Download a pre-compiled Windows build from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) (e.g., `ffmpeg-git-full.7z`).
2. Extract the archive using 7-Zip.
3. Rename the extracted folder to `ffmpeg` and move it to the root of your `C:\` drive (so it's `C:\ffmpeg`).
4. Add the `C:\ffmpeg\bin` folder to your Windows System PATH environment variable.
5. Open a new Command Prompt and run `ffmpeg -version` to verify the installation.

**Linux (Arch) Installation:**
```bash
sudo pacman -S ffmpeg
```

## Running the Application

### 1. Start the Backend Server
```bash
cd server
npm install
npm start
```
The server will start on port `3000` and will print the local network IP you can use to access it from other devices (e.g., your phone).

### 2. Start the Frontend Client
```bash
cd client
npm install
npm run dev
```
The Vite development server will start. Open the provided URL in your browser (usually `http://localhost:5173`).