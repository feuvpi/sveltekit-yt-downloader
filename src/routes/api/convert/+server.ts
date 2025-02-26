 // Fix for ESM import
import ytDlpWrapModule from 'yt-dlp-wrap';
import { json } from '@sveltejs/kit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the YTDlpWrap constructor from the default export
const YTDlpWrap = ytDlpWrapModule.default;

// Set up path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to ensure yt-dlp is available
async function ensureYtDlpBinary() {
  const platform = process.platform;
  const binaryName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const binaryPath = path.join(process.cwd(), binaryName);
  
  // Check if binary exists
  if (!fs.existsSync(binaryPath)) {
    console.log('yt-dlp binary not found, downloading...');
    try {
      // Download the latest version
      await YTDlpWrap.downloadFromGithub(binaryPath);
      
      // Make it executable on Unix systems
      if (platform !== 'win32') {
        fs.chmodSync(binaryPath, 0o755);
      }
      console.log('yt-dlp binary downloaded successfully');
    } catch (error) {
      console.error('Error downloading yt-dlp:', error);
      throw new Error('Failed to download yt-dlp binary');
    }
  }
  
  return binaryPath;
}

// Get video information including available formats
export async function GET({ url }) {
  const videoUrl = url.searchParams.get('url');
  
  if (!videoUrl) {
    return json({ error: 'URL não fornecido' }, { status: 400 });
  }
  
  try {
    const binaryPath = await ensureYtDlpBinary();
    const ytDlpWrap = new YTDlpWrap(binaryPath);
    
    // Get video info
    const videoInfo = await ytDlpWrap.getVideoInfo(videoUrl);
    
    // Extract relevant information
    const info = {
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      duration: videoInfo.duration,
      formats: videoInfo.formats
        .filter(format => format.ext === 'mp4' || format.acodec !== 'none')
        .map(format => ({
          formatId: format.format_id,
          ext: format.ext,
          resolution: format.resolution || 'audio only',
          filesize: format.filesize,
          audioBitrate: format.abr,
          isAudioOnly: !format.resolution || format.resolution === 'audio only'
        }))
    };
    
    return json(info);
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro ao obter informações do vídeo' }, { status: 500 });
  }
}

export async function POST({ request }) {
  const { url, format, quality, outputFormat } = await request.json();
  
  try {
    // Ensure yt-dlp binary is available
    const binaryPath = await ensureYtDlpBinary();
    
    // Initialize yt-dlp wrapper with the binary path
    const ytDlpWrap = new YTDlpWrap(binaryPath);
    
    // Get video info to extract title
    const videoInfo = await ytDlpWrap.getVideoInfo(url);
    
    // Sanitize the title for filename
    const videoTitle = videoInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    // Create downloads directory if it doesn't exist
    const downloadsDir = path.join(process.cwd(), 'static', 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
    
    const extension = outputFormat || 'mp3';
    const outputFilePath = path.join(downloadsDir, `${videoTitle}.${extension}`);
    
    // Prepare command options based on requested format
    const commandOptions = [url];
    
    if (format) {
      // If specific format ID is provided
      commandOptions.push('-f', format);
    } else if (outputFormat === 'mp4') {
      // Best video with audio for MP4
      commandOptions.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/mp4');
    } else {
      // Default to audio extraction for other formats
      commandOptions.push('-x');
      commandOptions.push('--audio-format', extension);
      
      // Apply quality if specified
      if (quality) {
        commandOptions.push('--audio-quality', quality);
      } else {
        commandOptions.push('--audio-quality', '128K');
      }
    }
    
    // Set output path
    commandOptions.push('-o', outputFilePath);
    
    // Set up progress tracking
    let progressData = {
      percent: 0,
      totalSize: 0,
      currentSpeed: 0,
      eta: 0
    };
    
    // Enable progress events
    const ytDlpEventEmitter = ytDlpWrap.exec(commandOptions)
      .on('progress', progress => {
        progressData = progress;
      })
      .on('error', error => {
        console.error('Download error:', error);
      });
      
    // Wait for process to complete
    await new Promise((resolve, reject) => {
      ytDlpEventEmitter.on('close', () => resolve());
      ytDlpEventEmitter.on('error', (error) => reject(error));
    });
    
    // Return the link to the downloaded file
    return json({ 
      fileUrl: `/downloads/${videoTitle}.${extension}`,
      fileTitle: videoInfo.title,
      duration: videoInfo.duration,
      thumbnail: videoInfo.thumbnail
    });
    
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro ao converter o vídeo' }, { status: 500 });
  }
}