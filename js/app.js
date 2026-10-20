/**
 * Mini Spotify App Controller
 * Manages Views, Search, Playlists, Liked Songs, Modals, Drag-and-Drop, and Keyboard Shortcuts
 */

class MiniSpotifyApp {
  constructor() {
    this.currentView = 'home';
    this.viewHistory = ['home'];
    this.historyIndex = 0;
    this.likedTrackIds = new Set(JSON.parse(localStorage.getItem('mini_spotify_liked_ids') || '["local-1", "local-4", "cur-1"]'));
    this.userPlaylists = JSON.parse(localStorage.getItem('mini_spotify_user_playlists') || '[]');
    this.searchDebounceTimer = null;
    this.activeSearchCategory = 'all';

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupDragAndDrop();
    window.spotifyAPI.connect().then(() => this.updateApiStatusUI()).catch(() => this.updateApiStatusUI());
    this.updateApiStatusUI();
    this.renderSidebarLibrary();
    this.renderHomeView();
    window.player.updateVolumeUI();
  }

  // Setup DOM Event Listeners
  setupEventListeners() {
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

  handleDroppedFiles(files) {
    const newTracks = files.map((file, idx) => {
      const url = URL.createObjectURL(file);
      const name = file.name.replace(/\.[^/.]+$/, "");
      return {
        id: `dropped-${Date.now()}-${idx}`,
        title: name,
        artist: 'Local Import',
        album: 'My Files',
        duration: 200,
        cover: 'img/logo.jpeg',
        audioUrl: url,
        isLocal: true,
        category: 'Local'
      };
    });

    window.spotifyAPI.localTracks.push(...newTracks);
    this.showToast(`🎵 Loaded ${files.length} custom audio track(s)!`);
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
              <img class="quick-card-img" src="${pl.cover}" alt="${pl.name}" />
              <span class="quick-card-title">${pl.name}</span>
              <button class="quick-play-btn" onclick="event.stopPropagation(); window.app.playPlaylist('${pl.id}')" title="Play ${pl.name}">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>

        <!-- Featured Local Tracks & Hits -->
        <div>
          <div class="section-header">
            <h2 class="section-title">Local Music & Highlights</h2>
            <a class="section-more-link" onclick="window.app.navigateTo('local')">Show all</a>
          </div>
          <div class="cards-grid">
            ${window.spotifyAPI.localTracks.map(track => `
              <div class="music-card" onclick="window.player.playTrack(window.spotifyAPI.getTrackById('${track.id}'), window.spotifyAPI.localTracks)">
                <div class="card-img-wrapper">
                  <img class="card-img" src="${track.cover}" alt="${track.title}" />
                  <button class="card-play-btn" title="Play ${track.title}">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                </div>
                <h3 class="card-title">${track.title}</h3>
                <p class="card-description">${track.artist} • ${track.album}</p>
              </div>
            `).join('')}
          </div>
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
                  <img class="card-img" src="${pl.cover}" alt="${pl.name}" />
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

    const mainContainer = document.getElementById('mainContentArea');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div class="view-container">
        <div class="detail-banner">
          <img class="banner-cover" src="${playlist.cover}" alt="${playlist.name}" />
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
        </div>

        ${this.renderTrackTable(playlist.tracks, playlist.tracks)}
      </div>
    `;
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
                        <span class="track-name">${t.title}</span>
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
          <img class="library-thumb" src="${pl.cover}" alt="${pl.name}" />
          <div class="library-info">
            <span class="library-item-title">${pl.name}</span>
            <span class="library-item-meta">Playlist • Spotify</span>
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
