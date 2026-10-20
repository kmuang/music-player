/**
 * Mini Spotify Player Engine & Web Audio API Visualizer
 */

class MusicPlayer {
  constructor() {
    this.audio = new Audio();
    this.currentTrack = null;
    this.queue = [];
    this.queueIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 'all'; // 'off', 'all', 'one'
    this.volume = parseFloat(localStorage.getItem('mini_spotify_volume') || '0.8');
    this.isMuted = false;
    
    // Web Audio API for Frequency Visualizer
    this.audioCtx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.isVisualizerInit = false;
    this.visualizerCanvas = null;
    this.canvasCtx = null;
    this.animFrameId = null;

    this.initAudioEvents();
  }

  initAudioEvents() {
    this.audio.volume = this.volume;

    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayStateUI(true);
      this.startVisualizer();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayStateUI(false);
    });

    this.audio.addEventListener('timeupdate', () => {
      this.updateProgressBar();
    });

    this.audio.addEventListener('ended', () => {
      this.handleTrackEnded();
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('Audio playback error, trying fallback:', e);
      window.app?.showToast('⚠️ Preview stream unavailable, falling back');
    });
  }

  // Lazy setup Web Audio Context on first user playback
  setupAudioContext() {
    if (this.isVisualizerInit) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      this.audio.crossOrigin = "anonymous";
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.isVisualizerInit = true;
    } catch (err) {
      console.warn('Web Audio API context could not be initialized:', err);
    }
  }

  // Play a track
  playTrack(track, queueList = null) {
    if (!track) return;
    
    // Resume audio context if suspended
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    } else if (!this.isVisualizerInit) {
      this.setupAudioContext();
    }

    if (queueList && Array.isArray(queueList)) {
      this.queue = [...queueList];
      this.queueIndex = this.queue.findIndex(t => t.id === track.id);
      if (this.queueIndex === -1) {
        this.queue.unshift(track);
        this.queueIndex = 0;
      }
    } else if (this.queue.length === 0 || !this.queue.find(t => t.id === track.id)) {
      this.queue = [track];
      this.queueIndex = 0;
    } else {
      this.queueIndex = this.queue.findIndex(t => t.id === track.id);
    }

    this.currentTrack = track;
    this.audio.src = track.audioUrl;
    this.audio.load();
    
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Playback autoplay restriction or error:', err);
      });
    }

    this.updateNowPlayingUI();
    this.updateQueueUI();
    window.app?.renderActiveTrackInTables();
  }

  // Toggle Play / Pause
  togglePlay() {
    if (!this.currentTrack) {
      // Play first available track
      const all = window.spotifyAPI.getAllLocalAndCuratedTracks();
      if (all.length > 0) {
        this.playTrack(all[0], all);
      }
      return;
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play().catch(e => console.warn(e));
    }
  }

  // Next Track
  next() {
    if (this.queue.length === 0) return;

    if (this.isShuffle) {
      let nextIndex = Math.floor(Math.random() * this.queue.length);
      if (this.queue.length > 1 && nextIndex === this.queueIndex) {
        nextIndex = (nextIndex + 1) % this.queue.length;
      }
      this.queueIndex = nextIndex;
    } else {
      this.queueIndex++;
      if (this.queueIndex >= this.queue.length) {
        if (this.repeatMode === 'all') {
          this.queueIndex = 0;
        } else {
          this.queueIndex = this.queue.length - 1;
          this.audio.pause();
          return;
        }
      }
    }

    const nextTrack = this.queue[this.queueIndex];
    if (nextTrack) {
      this.playTrack(nextTrack, this.queue);
    }
  }

  // Previous Track
  prev() {
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }

    if (this.queue.length === 0) return;

    this.queueIndex--;
    if (this.queueIndex < 0) {
      this.queueIndex = this.queue.length - 1;
    }

    const prevTrack = this.queue[this.queueIndex];
    if (prevTrack) {
      this.playTrack(prevTrack, this.queue);
    }
  }

  handleTrackEnded() {
    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.audio.play();
    } else {
      this.next();
    }
  }

  // Seek
  seekToPercentage(percent) {
    if (!this.audio.duration || isNaN(this.audio.duration)) return;
    this.audio.currentTime = (percent / 100) * this.audio.duration;
  }

  seekRelative(seconds) {
    if (!this.audio.duration) return;
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + seconds));
  }

  // Volume
  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    this.isMuted = false;
    this.audio.volume = this.volume;
    localStorage.setItem('mini_spotify_volume', this.volume.toString());
    this.updateVolumeUI();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audio.volume = this.isMuted ? 0 : this.volume;
    this.updateVolumeUI();
  }

  // Shuffle & Repeat Mode Toggles
  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    const shuffleBtn = document.getElementById('btnShuffle');
    if (shuffleBtn) {
      shuffleBtn.classList.toggle('active', this.isShuffle);
    }
    window.app?.showToast(this.isShuffle ? '🔀 Shuffle On' : '➡️ Shuffle Off');
  }

  toggleRepeat() {
    if (this.repeatMode === 'off') {
      this.repeatMode = 'all';
      window.app?.showToast('🔁 Repeat All');
    } else if (this.repeatMode === 'all') {
      this.repeatMode = 'one';
      window.app?.showToast('🔂 Repeat One Track');
    } else {
      this.repeatMode = 'off';
      window.app?.showToast('➡️ Repeat Off');
    }

    const repeatBtn = document.getElementById('btnRepeat');
    if (repeatBtn) {
      repeatBtn.classList.toggle('active', this.repeatMode !== 'off');
      if (this.repeatMode === 'one') {
        repeatBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2h-1v-4h-1v-1h2v5z"/>
          </svg>
        `;
      } else {
        repeatBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
          </svg>
        `;
      }
    }
  }

  // UI Updates
  updateNowPlayingUI() {
    if (!this.currentTrack) return;

    const thumb = document.getElementById('playerThumb');
    const title = document.getElementById('playerTrackTitle');
    const artist = document.getElementById('playerTrackArtist');
    const likeBtn = document.getElementById('playerLikeBtn');

    if (thumb) thumb.src = this.currentTrack.cover;
    if (title) title.textContent = this.currentTrack.title;
    if (artist) artist.textContent = this.currentTrack.artist;

    if (likeBtn) {
      const isLiked = window.app?.isTrackLiked(this.currentTrack.id);
      likeBtn.classList.toggle('liked', !!isLiked);
      likeBtn.innerHTML = isLiked ? `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      ` : `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      `;
    }

    // Update Visualizer Track Info
    const vizTitle = document.getElementById('vizTrackTitle');
    const vizArtist = document.getElementById('vizTrackArtist');
    if (vizTitle) vizTitle.textContent = this.currentTrack.title;
    if (vizArtist) vizArtist.textContent = this.currentTrack.artist;

    // Document Title
    document.title = `${this.currentTrack.title} • ${this.currentTrack.artist} | Mini Spotify`;
  }

  updatePlayStateUI(isPlaying) {
    const playBtn = document.getElementById('btnPlayPause');
    if (playBtn) {
      playBtn.innerHTML = isPlaying ? `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      ` : `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;
    }

    // Toggle active state in track tables
    window.app?.renderActiveTrackInTables();
  }

  updateProgressBar() {
    const curTime = this.audio.currentTime || 0;
    const duration = this.audio.duration || this.currentTrack?.duration || 0;

    const curTimeEl = document.getElementById('currentTimeLabel');
    const totalTimeEl = document.getElementById('totalTimeLabel');
    const progressFill = document.getElementById('progressFill');
    const progressHandle = document.getElementById('progressHandle');

    if (curTimeEl) curTimeEl.textContent = this.formatTime(curTime);
    if (totalTimeEl && duration) totalTimeEl.textContent = this.formatTime(duration);

    if (duration > 0 && progressFill) {
      const pct = (curTime / duration) * 100;
      progressFill.style.width = `${pct}%`;
      if (progressHandle) progressHandle.style.left = `${pct}%`;
    }
  }

  updateVolumeUI() {
    const volFill = document.getElementById('volumeFill');
    const volIcon = document.getElementById('btnVolumeIcon');
    const effectiveVol = this.isMuted ? 0 : this.volume;

    if (volFill) volFill.style.width = `${effectiveVol * 100}%`;

    if (volIcon) {
      if (effectiveVol === 0) {
        volIcon.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          </svg>
        `;
      } else if (effectiveVol < 0.5) {
        volIcon.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
          </svg>
        `;
      } else {
        volIcon.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        `;
      }
    }
  }

  updateQueueUI() {
    const queueBody = document.getElementById('queueList');
    if (!queueBody) return;

    if (this.queue.length === 0) {
      queueBody.innerHTML = '<p style="color:var(--text-subdued);font-size:0.85rem;padding:12px;">Queue is empty.</p>';
      return;
    }

    queueBody.innerHTML = this.queue.map((t, idx) => {
      const isCurrent = idx === this.queueIndex;
      return `
        <div class="library-item ${isCurrent ? 'active' : ''}" onclick="window.player.playTrack(window.player.queue[${idx}], window.player.queue)">
          <img class="library-thumb" src="${t.cover}" alt="${t.title}" />
          <div class="library-info">
            <span class="library-item-title">${t.title}</span>
            <span class="library-item-meta">${t.artist}</span>
          </div>
          <span style="font-size:0.75rem;color:var(--text-subdued);">${this.formatTime(t.duration)}</span>
        </div>
      `;
    }).join('');
  }

  // Visualizer Animation
  startVisualizer() {
    if (!this.analyser) return;
    this.visualizerCanvas = document.getElementById('visualizerCanvas');
    if (!this.visualizerCanvas) return;
    this.canvasCtx = this.visualizerCanvas.getContext('2d');

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      this.animFrameId = requestAnimationFrame(renderFrame);

      if (!this.isPlaying) return;

      this.analyser.getByteFrequencyData(dataArray);

      const width = this.visualizerCanvas.width;
      const height = this.visualizerCanvas.height;
      this.canvasCtx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.85;

        // Spotify Green Gradient
        const gradient = this.canvasCtx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#1ed760');
        gradient.addColorStop(0.5, '#1db954');
        gradient.addColorStop(1, '#0e4e26');

        this.canvasCtx.fillStyle = gradient;
        this.canvasCtx.beginPath();
        this.canvasCtx.roundRect(x, height - barHeight, barWidth - 4, barHeight, [4, 4, 0, 0]);
        this.canvasCtx.fill();

        x += barWidth;
      }
    };

    renderFrame();
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

// Global player instance
window.player = new MusicPlayer();
