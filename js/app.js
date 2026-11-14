/**
 * Mini Spotify App Controller
 * Manages Views, Search, Playlists, Liked Songs, Modals, Drag-and-Drop, and Keyboard Shortcuts
 */

class MiniSpotifyApp {
  constructor() {
    this.currentView = 'home';
    this.currentPlaylistId = null;
    this.viewHistory = ['home'];
    this.historyIndex = 0;
    this.likedTrackIds = new Set(JSON.parse(localStorage.getItem('mini_spotify_liked_ids') || '["local-1", "local-4"]'));
    this.likedTrackIds.delete('cur-1');
    this.likedTrackIds.delete('local-1');
    localStorage.setItem('mini_spotify_liked_ids', JSON.stringify(Array.from(this.likedTrackIds)));
    this.userPlaylists = JSON.parse(localStorage.getItem('mini_spotify_user_playlists') || '[]');
    this.playlistArtworkUrls = new Map();
    this.searchDebounceTimer = null;
    this.activeSearchCategory = 'all';

    this.init();
  }

  async init() {
    this.applyTheme(localStorage.getItem('mini-spotify-theme') || 'light', false);
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupDragAndDrop();
    this.restoreUserPlaylists();
    this.ensureGuitarSoloPlaylist();
    this.ensureInternationalPlaylist();
    this.ensureZomiPlaylist();
    this.ensureMyanmarPlaylist();
    this.ensureGospelPlaylist();
    this.ensureLibraryPlaylist();
    window.spotifyAPI.connect().then(() => this.updateApiStatusUI()).catch(() => this.updateApiStatusUI());
    this.updateApiStatusUI();
    try {
      const savedTracks = await window.localLibrary.getAll();
      const catalogIds = new Set(window.spotifyAPI.localTracks.map(track => track.id));
      const staleFolderTracks = savedTracks.filter(saved => this.isStaleFolderTrack(saved.id, catalogIds));
      await Promise.all(staleFolderTracks.map(saved => window.localLibrary.deleteTrack(saved.id).catch(() => {})));
      savedTracks.filter(saved => !this.isStaleFolderTrack(saved.id, catalogIds)).forEach(saved => {
        if (!saved.audioBlob) return;
        const audioUrl = URL.createObjectURL(saved.audioBlob);
        const existingTrack = window.spotifyAPI.localTracks.find(track => track.id === saved.id);
        if (existingTrack) {
          existingTrack.audioUrl = audioUrl;
          existingTrack.isUserImport = true;
          return;
        }
        window.spotifyAPI.localTracks.push({
          id: saved.id,
          title: saved.title,
          artist: saved.artist || 'My Music',
          album: saved.album || 'Personal Library',
          duration: saved.duration || 0,
          cover: saved.cover || 'img/logo.jpeg',
          audioUrl,
          audioBlob: saved.audioBlob,
          isLocal: true,
          isUserImport: true,
          category: 'Local'
        });
      });
    } catch (error) {
      console.warn('Saved local music could not be loaded:', error);
      this.showToast('Saved music storage is unavailable in this browser.');
    }

    try {
      const artworks = await window.localLibrary.getAllArtwork();
      artworks.forEach(item => {
        if (item.blob) this.playlistArtworkUrls.set(item.id, URL.createObjectURL(item.blob));
      });
    } catch (error) {
      console.warn('Saved playlist artwork could not be loaded:', error);
    }

    this.renderSidebarLibrary();
    this.renderHomeView();
    window.player.updateVolumeUI();
    // Show the library immediately; cache bundled audio in the background so
    // large files do not make the page appear stuck during startup.
    this.cacheBundledTracks();
  }

  applyTheme(theme, persist = true) {
    const selectedTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = selectedTheme;
    const isDark = selectedTheme === 'dark';
    const icon = document.getElementById('themeToggleIcon');
    const label = document.getElementById('themeToggleLabel');
    const button = document.getElementById('btnThemeToggle');
    if (icon) icon.textContent = isDark ? '☀' : '☾';
    if (label) label.textContent = isDark ? 'Light mode' : 'Dark mode';
    if (button) {
      button.title = `Switch to ${isDark ? 'light' : 'dark'} theme`;
      button.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
    }
    if (persist) localStorage.setItem('mini-spotify-theme', selectedTheme);
  }

  restoreUserPlaylists() {
    this.userPlaylists.forEach(playlist => {
      if (!window.spotifyAPI.curatedPlaylists.some(existing => existing.id === playlist.id)) {
        window.spotifyAPI.curatedPlaylists.push(playlist);
      }
    });
  }

  isStaleFolderTrack(id, catalogIds) {
    const prefixes = ['guitar-folder-', 'international-folder-', 'zomi-', 'myanmar-', 'gospel-', 'library-'];
    return prefixes.some(prefix => id.startsWith(prefix)) && !catalogIds.has(id);
  }

  syncBundledPlaylist({ id, name, description, cover, tracks }) {
    const existingIndex = this.userPlaylists.findIndex(item => item.id === id);
    const curatedIndex = window.spotifyAPI.curatedPlaylists.findIndex(item => item.id === id);

    if (!tracks.length) {
      if (existingIndex >= 0) this.userPlaylists.splice(existingIndex, 1);
      if (curatedIndex >= 0) window.spotifyAPI.curatedPlaylists.splice(curatedIndex, 1);
      localStorage.setItem('mini_spotify_user_playlists', JSON.stringify(this.userPlaylists));
      return;
    }

    let playlist = existingIndex >= 0 ? this.userPlaylists[existingIndex] : null;
    if (!playlist) {
      playlist = { id, name, description, cover, trackIds: [] };
      this.userPlaylists.push(playlist);
      window.spotifyAPI.curatedPlaylists.push(playlist);
    } else if (curatedIndex < 0) {
      window.spotifyAPI.curatedPlaylists.push(playlist);
    }

    if (!playlist.customArtwork) playlist.cover = cover;
    playlist.trackIds = tracks.map(track => track.id);
    localStorage.setItem('mini_spotify_user_playlists', JSON.stringify(this.userPlaylists));
  }

  ensureGuitarSoloPlaylist() {
    this.syncBundledPlaylist({
      id: 'user-pl-guitar-solo',
      name: 'Guitar Solo',
      description: 'Guitar tracks from your local music collection.',
      cover: 'img/guitar-solo-cover.svg',
      tracks: window.spotifyAPI.localTracks.filter(track => track.category === 'Guitar')
    });
  }

  ensureInternationalPlaylist() {
    this.syncBundledPlaylist({
      id: 'user-pl-international',
      name: 'International',
      description: 'Tracks from your international music folder.',
      cover: 'img/international-cover.svg',
      tracks: window.spotifyAPI.localTracks.filter(track => track.bundleCollection === 'international')
    });
  }

  ensureZomiPlaylist() {
    this.syncBundledPlaylist({
      id: 'user-pl-zomi',
      name: 'Zomi',
      description: 'Songs from your Zomi music folder.',
      cover: 'img/zomi-cover.svg',
      tracks: window.spotifyAPI.localTracks.filter(track => track.bundleCollection === 'zomi')
    });
  }

  ensureMyanmarPlaylist() {
    this.syncBundledPlaylist({
      id: 'user-pl-myanmar',
      name: 'Myanmar',
      description: 'Songs from your Myanmar music folder.',
      cover: 'img/myanmar-cover.svg',
      tracks: window.spotifyAPI.localTracks.filter(track => track.bundleCollection === 'myanmar')
    });
  }

  ensureGospelPlaylist() {
    this.syncBundledPlaylist({
      id: 'user-pl-gospel',
      name: 'Gospel',
      description: 'Songs from your Gospel music folder.',
      cover: 'img/gospel-cover.svg',
      tracks: window.spotifyAPI.localTracks.filter(track => track.bundleCollection === 'gospel')
    });
  }

  ensureLibraryPlaylist() {
    this.syncBundledPlaylist({
      id: 'user-pl-library',
      name: 'Library',
      description: 'Songs from your music library folder.',
      cover: 'img/library-cover.svg',
      tracks: window.spotifyAPI.localTracks.filter(track => track.bundleCollection === 'library')
    });
  }

  async cacheBundledTracks() {
    try {
      const savedTracks = await window.localLibrary.getAll();
      const savedIds = new Set(savedTracks.map(track => track.id));
      const bundledTracks = window.spotifyAPI.localTracks.filter(track => track.id === 'local-4' || track.isBundledMusic);

      for (const track of bundledTracks) {
        if (savedIds.has(track.id)) continue;
        try {
          const response = await fetch(track.audioUrl);
          if (!response.ok) throw new Error(`Could not load ${track.title}.`);
          const savedTrack = {
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: track.duration,
            cover: track.cover,
            audioBlob: await response.blob(),
            category: track.category
          };
          await window.localLibrary.saveMany([savedTrack]);
          savedIds.add(track.id);
          const currentTrack = window.spotifyAPI.localTracks.find(item => item.id === track.id);
          if (currentTrack) currentTrack.audioUrl = URL.createObjectURL(savedTrack.audioBlob);
        } catch (error) {
          console.warn(`Could not save bundled track "${track.title}" to IndexedDB:`, error);
        }
      }
    } catch (error) {
      console.warn('Bundled guitar tracks could not be saved to IndexedDB:', error);
    }
  }

  // Setup DOM Event Listeners
  setupEventListeners() {
    document.getElementById('btnThemeToggle')?.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      this.applyTheme(nextTheme);
    });

    // Navigation Links
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const view = el.getAttribute('data-nav');
        this.navigateTo(view);
      });
    });

    // History Back / Forward
    document.getElementById('btnNavBack')?.addEventListener('click', () => this.navBack());
    document.getElementById('btnNavForward')?.addEventListener('click', () => this.navForward());

    // Search Input
    const searchInput = document.getElementById('globalSearchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');

    searchInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (searchClearBtn) searchClearBtn.classList.toggle('visible', val.length > 0);
      
      if (this.currentView !== 'search') {
        this.navigateTo('search', false);
      }

      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.performSearch(val);
      }, 300);
    });

    searchClearBtn?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchClearBtn.classList.remove('visible');
        this.renderSearchInitialView();
      }
    });

    // Player Controls
    document.getElementById('btnPlayPause')?.addEventListener('click', () => window.player.togglePlay());
    document.getElementById('btnNext')?.addEventListener('click', () => window.player.next());
    document.getElementById('btnPrev')?.addEventListener('click', () => window.player.prev());
    document.getElementById('btnShuffle')?.addEventListener('click', () => window.player.toggleShuffle());
    document.getElementById('btnRepeat')?.addEventListener('click', () => window.player.toggleRepeat());
    document.getElementById('playerLikeBtn')?.addEventListener('click', () => {
      if (window.player.currentTrack) {
        this.toggleLike(window.player.currentTrack.id);
      }
    });

    // Scrubber Interaction
    const scrubber = document.getElementById('progressBarContainer');
    if (scrubber) {
      scrubber.addEventListener('click', (e) => {
        const rect = scrubber.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
        window.player.seekToPercentage(percent);
      });
    }

    // Volume Interaction
    const volContainer = document.getElementById('volumeSliderContainer');
    if (volContainer) {
      volContainer.addEventListener('click', (e) => {
        const rect = volContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const vol = Math.max(0, Math.min(1, clickX / rect.width));
        window.player.setVolume(vol);
      });
    }
    document.getElementById('btnVolumeIcon')?.addEventListener('click', () => window.player.toggleMute());

    // Modals
    document.getElementById('btnOpenApiModal')?.addEventListener('click', () => this.openApiModal());
    document.getElementById('btnCloseApiModal')?.addEventListener('click', () => this.closeApiModal());
    document.getElementById('apiModalBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'apiModalBackdrop') this.closeApiModal();
    });
    document.getElementById('btnSaveApiSettings')?.addEventListener('click', () => this.handleSaveApiSettings());
    document.getElementById('btnDemoModeToggle')?.addEventListener('click', () => this.enableDemoMode());

    // Queue Drawer Toggle
    document.getElementById('btnToggleQueue')?.addEventListener('click', () => {
      const queueDrawer = document.getElementById('queueDrawer');
      if (queueDrawer) {
        queueDrawer.classList.toggle('open');
        if (queueDrawer.classList.contains('open')) {
          window.player.updateQueueUI();
        }
      }
    });
    document.getElementById('btnCloseQueue')?.addEventListener('click', () => {
      document.getElementById('queueDrawer')?.classList.remove('open');
    });

    // Visualizer Overlay Toggle
    document.getElementById('btnToggleVisualizer')?.addEventListener('click', () => {
      document.getElementById('visualizerOverlay')?.classList.add('active');
    });
    document.getElementById('btnCloseVisualizer')?.addEventListener('click', () => {
      document.getElementById('visualizerOverlay')?.classList.remove('active');
    });

    // Create Playlist Button
    document.getElementById('btnCreatePlaylist')?.addEventListener('click', () => this.createNewPlaylist());
  }

  // Keyboard Shortcuts
  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore when typing inside input fields
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        window.player.togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        window.player.seekRelative(5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        window.player.seekRelative(-5);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        window.player.setVolume(window.player.volume + 0.05);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        window.player.setVolume(window.player.volume - 0.05);
      } else if (e.key === 'm' || e.key === 'M') {
        window.player.toggleMute();
      } else if (e.key === 'l' || e.key === 'L') {
        if (window.player.currentTrack) {
          this.toggleLike(window.player.currentTrack.id);
        }
      }
    });
  }

  // Drag & Drop Local Audio Files
  setupDragAndDrop() {
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/') || f.name.endsWith('.mp3') || f.name.endsWith('.wav'));
      if (files.length > 0) {
        this.handleDroppedFiles(files);
      }
    });
  }

  async handleDroppedFiles(files) {
    const newTracks = files.map((file, idx) => {
      const url = URL.createObjectURL(file);
      const name = file.name.replace(/\.[^/.]+$/, "");
      return {
        id: `import-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        title: name,
        artist: 'Local Import',
        album: 'My Files',
        duration: 200,
        cover: 'img/logo.jpeg',
        audioUrl: url,
        isLocal: true,
        isUserImport: true,
        audioBlob: file,
        category: 'Local'
      };
    });

    window.spotifyAPI.localTracks.push(...newTracks);
    try {
      await window.localLibrary.saveMany(newTracks.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        cover: track.cover,
        audioBlob: track.audioBlob,
        category: track.category
      })));
      this.showToast(`🎵 Saved ${files.length} track(s) to this browser.`);
    } catch (error) {
      console.error('Could not persist imported audio:', error);
      this.showToast('Tracks loaded for this session, but browser storage could not save them.');
    }
    this.renderSidebarLibrary();
    this.navigateTo('local');
    if (newTracks.length > 0) {
      window.player.playTrack(newTracks[0], window.spotifyAPI.localTracks);
    }
  }

  // Navigation System
  navigateTo(view, recordHistory = true) {
    this.currentView = view;
    if (recordHistory) {
      this.viewHistory.push(view);
      this.historyIndex = this.viewHistory.length - 1;
    }

    // Update Sidebar Active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-nav') === view);
    });

    // Update Nav History Buttons
    const btnBack = document.getElementById('btnNavBack');
    const btnFwd = document.getElementById('btnNavForward');
    if (btnBack) btnBack.disabled = this.historyIndex <= 0;
    if (btnFwd) btnFwd.disabled = this.historyIndex >= this.viewHistory.length - 1;

    // Render View Content
    switch (view) {
      case 'home':
        this.renderHomeView();
        break;
      case 'search':
        this.renderSearchInitialView();
        break;
      case 'library':
      case 'local':
        this.renderLocalFilesView();
        break;
      case 'liked':
        this.renderLikedSongsView();
        break;
      default:
        this.renderHomeView();
    }
  }

  navBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const view = this.viewHistory[this.historyIndex];
      this.navigateTo(view, false);
    }
  }

  navForward() {
    if (this.historyIndex < this.viewHistory.length - 1) {
      this.historyIndex++;
      const view = this.viewHistory[this.historyIndex];
      this.navigateTo(view, false);
    }
  }

  // View: Home
  renderHomeView() {
    const greeting = this.getGreeting();
    const allTracks = window.spotifyAPI.getAllLocalAndCuratedTracks();
    const playlists = window.spotifyAPI.curatedPlaylists;
    const categories = window.spotifyAPI.categories;

    const mainContainer = document.getElementById('mainContentArea');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div class="view-container">
        <!-- Hero Greeting -->
        <div class="hero-header">
          <h1 class="greeting-text">${greeting}</h1>
        </div>

        <!-- Quick 6-Grid Access -->
        <div class="quick-grid">
          ${playlists.slice(0, 6).map(pl => `
            <div class="quick-card" onclick="window.app.openPlaylist('${pl.id}')">
              <img class="quick-card-img" src="${this.getPlaylistCover(pl)}" alt="${pl.name}" />
              <span class="quick-card-title">${pl.name}</span>
              <button class="quick-play-btn" onclick="event.stopPropagation(); window.app.playPlaylist('${pl.id}')" title="Play ${pl.name}">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>

        <!-- Featured Playlists -->
        <div>
          <div class="section-header">
            <h2 class="section-title">Featured Playlists</h2>
          </div>
          <div class="cards-grid">
            ${playlists.map(pl => `
              <div class="music-card" onclick="window.app.openPlaylist('${pl.id}')">
                <div class="card-img-wrapper">
                  <img class="card-img" src="${this.getPlaylistCover(pl)}" alt="${pl.name}" />
                  <button class="card-play-btn" onclick="event.stopPropagation(); window.app.playPlaylist('${pl.id}')" title="Play ${pl.name}">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                </div>
                <h3 class="card-title">${pl.name}</h3>
                <p class="card-description">${pl.description}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Top Hits Track Table -->
        <div>
          <div class="section-header">
            <h2 class="section-title">Top Charts & Tracks</h2>
          </div>
          ${this.renderTrackTable(allTracks.slice(0, 8), allTracks)}
        </div>
      </div>
    `;
  }

  // View: Search Initial / Browse
  renderSearchInitialView() {
    const categories = window.spotifyAPI.categories;
    const mainContainer = document.getElementById('mainContentArea');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div class="view-container">
        <h1 class="section-title" style="font-size:1.8rem;">Browse all</h1>
        <div class="cards-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
          ${categories.map(cat => `
            <div class="category-card" style="background-color: ${cat.color};" onclick="window.app.searchByCategory('${cat.name}')">
              <h3 class="category-title">${cat.name}</h3>
              <img class="category-img" src="${cat.cover}" alt="${cat.name}" />
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  searchByCategory(catName) {
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
      searchInput.value = catName;
      document.getElementById('searchClearBtn')?.classList.add('visible');
    }
    this.performSearch(catName);
  }

  // Perform Live Spotify Search
  async performSearch(query) {
    if (!query) {
      this.renderSearchInitialView();
      return;
    }

    const mainContainer = document.getElementById('mainContentArea');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div class="view-container">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="playing-animation" style="display:flex;">
            <span></span><span></span><span></span><span></span>
          </div>
          <p style="color:var(--text-subdued);">Searching Spotify for "<b>${query}</b>"...</p>
        </div>
      </div>
    `;

    const results = await window.spotifyAPI.search(query);

    mainContainer.innerHTML = `
      <div class="view-container">
        <div class="search-tabs">
          <button class="search-tab-btn ${this.activeSearchCategory === 'all' ? 'active' : ''}" onclick="window.app.setSearchTab('all', '${query}')">All</button>
          <button class="search-tab-btn ${this.activeSearchCategory === 'tracks' ? 'active' : ''}" onclick="window.app.setSearchTab('tracks', '${query}')">Songs (${results.tracks.length})</button>
          <button class="search-tab-btn ${this.activeSearchCategory === 'artists' ? 'active' : ''}" onclick="window.app.setSearchTab('artists', '${query}')">Artists (${results.artists.length})</button>
        </div>

        ${results.tracks.length === 0 && results.artists.length === 0 ? `
          <div style="text-align:center;padding:48px;color:var(--text-subdued);">
            <h3>No results found for "${query}"</h3>
            <p style="font-size:0.85rem;margin-top:8px;">Please check your spelling or try another keyword.</p>
          </div>
        ` : ''}

        <!-- Top Result & Tracks -->
        ${results.tracks.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <h2 class="section-title">Songs</h2>
            ${this.renderTrackTable(results.tracks, results.tracks)}
          </div>
        ` : ''}

        <!-- Artists Grid -->
        ${results.artists.length > 0 ? `
          <div>
            <h2 class="section-title">Artists</h2>
            <div class="cards-grid">
              ${results.artists.map(art => `
                <div class="music-card">
                  <div class="card-img-wrapper">
                    <img class="card-img artist-circle" src="${art.cover}" alt="${art.name}" />
                  </div>
                  <h3 class="card-title">${art.name}</h3>
                  <p class="card-description">Artist ${art.genres.length ? '• ' + art.genres.slice(0, 2).join(', ') : ''}</p>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  setSearchTab(cat, query) {
    this.activeSearchCategory = cat;
    this.performSearch(query);
  }

  // View: Liked Songs
  renderLikedSongsView() {
    const all = window.spotifyAPI.getAllLocalAndCuratedTracks();
    const likedTracks = all.filter(t => this.likedTrackIds.has(t.id));

    const mainContainer = document.getElementById('mainContentArea');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div class="view-container">
        <div class="detail-banner" style="background: linear-gradient(180deg, rgba(80, 50, 180, 0.6) 0%, rgba(18, 18, 18, 0) 100%);">
          <div class="library-thumb liked-thumb" style="width:192px;height:192px;border-radius:var(--radius-sm);box-shadow:0 16px 36px rgba(0,0,0,0.6);font-size:4rem;">
            ❤️
          </div>
          <div class="banner-info">
            <span class="banner-tag">Playlist</span>
            <h1 class="banner-title">Liked Songs</h1>
            <div class="banner-meta">
              <img src="img/me.JPG" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" />
              <b>Khup Muang</b> • ${likedTracks.length} song${likedTracks.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        <div class="banner-actions">
          <button class="banner-play-btn" onclick="window.player.playTrack(window.spotifyAPI.getTrackById('${likedTracks[0]?.id}'), [${likedTracks.map(t => `'${t.id}'`).join(',')}].map(id => window.spotifyAPI.getTrackById(id)))" title="Play Liked Songs">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>

        ${likedTracks.length === 0 ? `
          <div style="text-align:center;padding:48px;color:var(--text-subdued);">
            <h3>Songs you like will appear here</h3>
            <p style="font-size:0.85rem;margin-top:8px;">Save songs by tapping the heart icon anywhere in the app.</p>
          </div>
        ` : this.renderTrackTable(likedTracks, likedTracks)}
      </div>
    `;
  }

  // View: Local Music
  renderLocalFilesView() {
    const localTracks = window.spotifyAPI.localTracks;
    const mainContainer = document.getElementById('mainContentArea');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div class="view-container">
        <div class="detail-banner" style="background: linear-gradient(180deg, rgba(30, 100, 60, 0.6) 0%, rgba(18, 18, 18, 0) 100%);">
          <img class="banner-cover" src="img/me.JPG" alt="Local Collection" />
          <div class="banner-info">
            <span class="banner-tag">Local Library</span>
            <h1 class="banner-title">My Audio Tracks</h1>
            <div class="banner-meta">
              <b>Local Workspace Files</b> • ${localTracks.length} tracks • MP3 Audio
            </div>
          </div>
        </div>

        <div class="banner-actions">
          <button class="banner-play-btn" onclick="window.player.playTrack(window.spotifyAPI.localTracks[0], window.spotifyAPI.localTracks)">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>

        <!-- Drag & Drop Zone -->
        <div class="drop-zone" onclick="document.getElementById('localAudioFileInput').click()">
          <input type="file" id="localAudioFileInput" accept="audio/*" multiple style="display:none;" onchange="window.app.handleFileInputChange(event)" />
          <p style="font-size:1.1rem;font-weight:700;margin-bottom:4px;">📥 Drag & Drop Audio Files Here</p>
          <p style="font-size:0.82rem;color:var(--text-subdued);">Or click to browse MP3 / WAV files from your computer</p>
        </div>

        ${this.renderTrackTable(localTracks, localTracks)}
      </div>
    `;
  }

  handleFileInputChange(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      this.handleDroppedFiles(files);
    }
  }

  // Open Playlist Detail View
  openPlaylist(playlistId) {
    const playlist = window.spotifyAPI.getPlaylistById(playlistId);
    if (!playlist) return;

    if (this.currentView !== 'playlist') {
      this.playlistReturnView = this.currentView;
    }
    this.currentView = 'playlist';
    this.currentPlaylistId = playlistId;
    const isUserPlaylist = this.userPlaylists.some(item => item.id === playlistId);
    const playlistCover = this.getPlaylistCover(playlist);

    const mainContainer = document.getElementById('mainContentArea');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div class="view-container">
        <button class="playlist-return-btn" onclick="window.app.returnFromPlaylist()" aria-label="Return to previous page">
          <span aria-hidden="true">←</span> Back
        </button>
        <div class="detail-banner">
          <img class="banner-cover" src="${playlistCover}" alt="${playlist.name}" />
          <div class="banner-info">
            <span class="banner-tag">Playlist</span>
            <h1 class="banner-title">${playlist.name}</h1>
            <p style="font-size:0.9rem;color:var(--text-subdued);">${playlist.description}</p>
            <div class="banner-meta">
              <img src="img/logo.jpeg" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" />
              <b>Mini Spotify</b> • ${playlist.tracks.length} songs
            </div>
          </div>
        </div>

        <div class="banner-actions">
          <button class="banner-play-btn" onclick="window.app.playPlaylist('${playlist.id}')" title="Play ${playlist.name}">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
          ${isUserPlaylist ? `
            <button class="playlist-management-button" onclick="window.app.renamePlaylist('${playlist.id}')">Rename playlist</button>
            <label class="playlist-management-button playlist-artwork-picker" tabindex="0" onkeydown="if(event.key === 'Enter' || event.key === ' '){event.preventDefault();this.querySelector('input').click();}">Choose artwork
              <input type="file" accept="image/*" onchange="window.app.handlePlaylistArtworkChange(event, '${playlist.id}')" />
            </label>
          ` : ''}
        </div>

        ${this.renderTrackTable(playlist.tracks, playlist.tracks)}
      </div>
    `;
  }

  returnFromPlaylist() {
    const destination = this.playlistReturnView && this.playlistReturnView !== 'playlist'
      ? this.playlistReturnView
      : 'home';
    this.currentPlaylistId = null;
    this.navigateTo(destination, false);
  }

  getPlaylistCover(playlist) {
    return this.playlistArtworkUrls.get(playlist.id) || playlist.cover || 'img/logo.jpeg';
  }

  refreshCurrentView() {
    this.renderSidebarLibrary();
    if (this.currentView === 'playlist' && this.currentPlaylistId) {
      this.openPlaylist(this.currentPlaylistId);
    } else if (this.currentView === 'local' || this.currentView === 'library') {
      this.renderLocalFilesView();
    } else if (this.currentView === 'liked') {
      this.renderLikedSongsView();
    } else if (this.currentView === 'search') {
      const query = document.getElementById('globalSearchInput')?.value.trim();
      if (query) this.performSearch(query);
      else this.renderSearchInitialView();
    } else {
      this.renderHomeView();
    }
  }

  async renameImportedTrack(trackId) {
    const track = window.spotifyAPI.localTracks.find(item => item.id === trackId && item.isUserImport);
    if (!track) return;
    const nextName = prompt('Rename track:', track.title)?.trim();
    if (!nextName || nextName === track.title) return;

    try {
      const saved = await window.localLibrary.get(trackId);
      if (saved) {
        saved.title = nextName;
        await window.localLibrary.saveMany([saved]);
      } else if (track.audioBlob) {
        await window.localLibrary.saveMany([{
          id: track.id, title: nextName, artist: track.artist, album: track.album,
          duration: track.duration, cover: track.cover, audioBlob: track.audioBlob, category: track.category
        }]);
      } else {
        throw new Error('The saved audio record is unavailable.');
      }
      track.title = nextName;
      if (window.player.currentTrack?.id === trackId) window.player.updateNowPlayingUI();
      this.refreshCurrentView();
      this.showToast('Track name updated.');
    } catch (error) {
      console.error('Could not rename imported track:', error);
      this.showToast('Could not save the new track name.');
    }
  }

  async removeImportedTrack(trackId) {
    const track = window.spotifyAPI.localTracks.find(item => item.id === trackId && item.isUserImport);
    if (!track) return;
    if (!confirm(`Remove “${track.title}” from this browser? This also deletes its saved audio.`)) return;

    try {
      await window.localLibrary.deleteTrack(trackId);
    } catch (error) {
      console.error('Could not remove imported track from storage:', error);
      this.showToast('Could not remove the saved audio file.');
      return;
    }

    window.player.removeTrackFromLibrary(trackId);
    if (track.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(track.audioUrl);
    window.spotifyAPI.localTracks = window.spotifyAPI.localTracks.filter(item => item.id !== trackId);
    this.likedTrackIds.delete(trackId);
    localStorage.setItem('mini_spotify_liked_ids', JSON.stringify(Array.from(this.likedTrackIds)));
    this.userPlaylists.forEach(playlist => {
      playlist.trackIds = (playlist.trackIds || []).filter(id => id !== trackId);
    });
    localStorage.setItem('mini_spotify_user_playlists', JSON.stringify(this.userPlaylists));
    this.refreshCurrentView();
    this.showToast('Imported track removed.');
  }

  renamePlaylist(playlistId) {
    const playlist = this.userPlaylists.find(item => item.id === playlistId);
    if (!playlist) return;
    const nextName = prompt('Rename playlist:', playlist.name)?.trim();
    if (!nextName || nextName === playlist.name) return;
    playlist.name = nextName;
    localStorage.setItem('mini_spotify_user_playlists', JSON.stringify(this.userPlaylists));
    this.refreshCurrentView();
    this.showToast('Playlist name updated.');
  }

  async handlePlaylistArtworkChange(event, playlistId) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast('Choose an image file for playlist artwork.');
      event.target.value = '';
      return;
    }

    try {
      await window.localLibrary.saveArtwork(playlistId, file);
      const previousUrl = this.playlistArtworkUrls.get(playlistId);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      this.playlistArtworkUrls.set(playlistId, URL.createObjectURL(file));
      const playlist = this.userPlaylists.find(item => item.id === playlistId);
      if (playlist) playlist.customArtwork = true;
      localStorage.setItem('mini_spotify_user_playlists', JSON.stringify(this.userPlaylists));
      this.refreshCurrentView();
      this.showToast('Playlist artwork updated.');
    } catch (error) {
      console.error('Could not save playlist artwork:', error);
      this.showToast('Could not save that artwork in this browser.');
    } finally {
      event.target.value = '';
    }
  }

  playPlaylist(playlistId) {
    const playlist = window.spotifyAPI.getPlaylistById(playlistId);
    if (playlist && playlist.tracks.length > 0) {
      window.player.playTrack(playlist.tracks[0], playlist.tracks);
    }
  }

  // Helper: Render Spotify Track Table
  renderTrackTable(tracks, queueList = null) {
    if (!tracks || tracks.length === 0) {
      return '<p style="color:var(--text-subdued);padding:16px;">No tracks available.</p>';
    }

    return `
      <div class="track-table-container">
        <table class="track-table">
          <thead>
            <tr>
              <th class="col-index">#</th>
              <th>Title</th>
              <th class="col-album">Album</th>
              <th class="col-duration">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${tracks.map((t, idx) => {
              const isCurrent = window.player.currentTrack?.id === t.id;
              const isLiked = this.isTrackLiked(t.id);
              return `
                <tr class="track-row ${isCurrent ? 'active' : ''}" data-track-id="${t.id}" onclick="window.app.handleTrackRowClick('${t.id}')">
                  <td class="track-index-cell">
                    <span class="track-number">${idx + 1}</span>
                    <button class="track-row-play-btn">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                    <div class="playing-animation">
                      <span></span><span></span><span></span><span></span>
                    </div>
                  </td>
                  <td>
                    <div class="track-info-cell">
                      <img class="track-thumb" src="${t.cover}" alt="${t.title}" />
                      <div class="track-meta">
                        <div class="track-title-line">
                          <span class="track-name">${t.title}</span>
                          ${t.isUserImport ? `
                            <span class="track-management-actions">
                              <button class="track-manage-btn" onclick="event.stopPropagation(); window.app.renameImportedTrack('${t.id}')" aria-label="Rename track" title="Rename track">✎</button>
                              <button class="track-manage-btn track-remove-btn" onclick="event.stopPropagation(); window.app.removeImportedTrack('${t.id}')" aria-label="Remove imported track" title="Remove imported track">×</button>
                            </span>
                          ` : ''}
                        </div>
                        <span class="track-artist">${t.artist}</span>
                      </div>
                    </div>
                  </td>
                  <td class="track-album-cell col-album">${t.album || 'Single'}</td>
                  <td class="track-actions-cell col-duration">
                    <button class="track-action-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); window.app.toggleLike('${t.id}')" title="Like">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                    </button>
                    <span>${window.player.formatTime(t.duration)}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  handleTrackRowClick(trackId) {
    const track = window.spotifyAPI.getTrackById(trackId) || window.spotifyAPI.getAllLocalAndCuratedTracks().find(t => t.id === trackId);
    if (track) {
      window.player.playTrack(track, window.spotifyAPI.getAllLocalAndCuratedTracks());
    }
  }

  renderActiveTrackInTables() {
    const curId = window.player.currentTrack?.id;
    document.querySelectorAll('.track-row').forEach(row => {
      const rowTrackId = row.getAttribute('data-track-id');
      row.classList.toggle('active', rowTrackId === curId);
    });
  }

  // Liked Songs Management
  isTrackLiked(trackId) {
    return this.likedTrackIds.has(trackId);
  }

  toggleLike(trackId) {
    if (this.likedTrackIds.has(trackId)) {
      this.likedTrackIds.delete(trackId);
      this.showToast('💔 Removed from Liked Songs');
    } else {
      this.likedTrackIds.add(trackId);
      this.showToast('💚 Added to Liked Songs');
    }

    localStorage.setItem('mini_spotify_liked_ids', JSON.stringify(Array.from(this.likedTrackIds)));
    window.player.updateNowPlayingUI();
    this.renderSidebarLibrary();

    if (this.currentView === 'liked') {
      this.renderLikedSongsView();
    } else {
      this.renderActiveTrackInTables();
      // Re-render like buttons in active table
      document.querySelectorAll(`tr[data-track-id="${trackId}"] .track-action-btn`).forEach(btn => {
        const isLiked = this.isTrackLiked(trackId);
        btn.classList.toggle('liked', isLiked);
        btn.querySelector('svg')?.setAttribute('fill', isLiked ? 'currentColor' : 'none');
      });
    }
  }

  // Sidebar Library Playlists Render
  renderSidebarLibrary() {
    const libraryList = document.getElementById('sidebarLibraryList');
    if (!libraryList) return;

    const likedCount = this.likedTrackIds.size;
    const localCount = window.spotifyAPI.localTracks.length;

    let html = `
      <div class="library-item ${this.currentView === 'liked' ? 'active' : ''}" onclick="window.app.navigateTo('liked')">
        <div class="library-thumb liked-thumb">
          ❤️
        </div>
        <div class="library-info">
          <span class="library-item-title">Liked Songs</span>
          <span class="library-item-meta">Playlist • ${likedCount} songs</span>
        </div>
      </div>

      <div class="library-item ${this.currentView === 'local' ? 'active' : ''}" onclick="window.app.navigateTo('local')">
        <img class="library-thumb" src="img/me.JPG" alt="Local Files" />
        <div class="library-info">
          <span class="library-item-title">Local Audio Files</span>
          <span class="library-item-meta">Playlist • ${localCount} songs</span>
        </div>
      </div>
    `;

    // Curated Playlists
    window.spotifyAPI.curatedPlaylists.forEach(pl => {
      html += `
        <div class="library-item" onclick="window.app.openPlaylist('${pl.id}')">
          <img class="library-thumb" src="${this.getPlaylistCover(pl)}" alt="${pl.name}" />
          <div class="library-info">
            <span class="library-item-title">${pl.name}</span>
          <span class="library-item-meta">Playlist • ${this.userPlaylists.some(userPlaylist => userPlaylist.id === pl.id) ? 'You' : 'Spotify'}</span>
          </div>
        </div>
      `;
    });

    libraryList.innerHTML = html;
  }

  // Create New Playlist
  createNewPlaylist() {
    const name = prompt('Enter new playlist name:', `My Playlist #${this.userPlaylists.length + 1}`);
    if (!name || !name.trim()) return;

    const newPl = {
      id: `user-pl-${Date.now()}`,
      name: name.trim(),
      description: 'Custom user created playlist',
      cover: 'img/logo.jpeg',
      trackIds: []
    };

    window.spotifyAPI.curatedPlaylists.push(newPl);
    this.userPlaylists.push(newPl);
    localStorage.setItem('mini_spotify_user_playlists', JSON.stringify(this.userPlaylists));
    this.showToast(`✨ Created playlist "${newPl.name}"`);
    this.renderSidebarLibrary();
    this.openPlaylist(newPl.id);
  }

  // Spotify API Settings Modal
  openApiModal() {
    document.getElementById('apiModalBackdrop')?.classList.add('open');
  }

  closeApiModal() {
    document.getElementById('apiModalBackdrop')?.classList.remove('open');
  }

  async handleSaveApiSettings() {
    const res = await window.spotifyAPI.connect();
    this.updateApiStatusUI();
    this.closeApiModal();

    if (res.success && res.mode === 'live') {
      this.showToast('🟢 Connected to live Spotify Web API!');
    } else if (res.mode === 'demo') {
      this.showToast('🟡 Operating in Demo Mode with local catalog');
    } else {
      this.showToast(`⚠️ Auth error: ${res.error || 'Please check keys'}`);
    }
  }

  enableDemoMode() {
    window.spotifyAPI.isDemoMode = true;
    this.updateApiStatusUI();
    this.closeApiModal();
    this.showToast('🟡 Switched to Demo Mode');
  }

  updateApiStatusUI() {
    const badge = document.getElementById('btnOpenApiModal');
    const dot = document.getElementById('statusDot');
    const label = document.getElementById('apiStatusLabel');

    if (!badge || !dot || !label) return;

    if (!window.spotifyAPI.isDemoMode) {
      dot.className = 'status-dot connected';
      label.textContent = 'Spotify API Live';
    } else {
      dot.className = 'status-dot demo';
      label.textContent = 'Demo Mode (Click to setup API)';
    }
  }

  // Toast Notification
  showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }
}

// Instantiate App
window.addEventListener('DOMContentLoaded', () => {
  window.app = new MiniSpotifyApp();
});
