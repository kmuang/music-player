/**
 * Spotify Web API Client Module
 * Handles Authentication (Client Credentials / Bearer Token), Endpoints, Search, and Rich Fallback Data
 */

class SpotifyAPI {
  constructor() {
    this.isDemoMode = true;
    this.baseUrl = 'https://api.spotify.com/v1';
    this.proxyUrl = '/api/spotify';
    
    // Built-in Local Tracks
    this.localTracks = [
      {
        id: 'local-1',
        title: 'Pop Anthem',
        artist: 'Khup Muang',
        album: 'Acoustic & Pop Sessions',
        duration: 184, // ~3:04
        cover: 'img/me.JPG',
        audioUrl: 'music/audio.mp3',
        isLocal: true,
        category: 'Pop'
      },
      {
        id: 'local-2',
        title: 'Lost in Universe',
        artist: 'Khup Muang',
        album: 'Cosmic Horizons',
        duration: 165,
        cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
        audioUrl: 'music/lost.mp3',
        isLocal: true,
        category: 'Chill'
      },
      {
        id: 'local-3',
        title: 'Thai Melody',
        artist: 'Khup Muang',
        album: 'World & Folk Strings',
        duration: 215,
        cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        audioUrl: 'music/thai.mp3',
        isLocal: true,
        category: 'Acoustic'
      },
      {
        id: 'local-4',
        title: 'Titanic Solo Guitar',
        artist: 'Khup Muang',
        album: 'Cinema Guitar Solos',
        duration: 198,
        cover: 'img/logo.jpeg',
        audioUrl: 'music/titanic.mp3',
        isLocal: true,
        category: 'Guitar'
      }
    ];

    // Rich Pre-loaded Curated Spotify-grade Catalog
    this.curatedTracks = [
      {
        id: 'cur-1',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        album: 'After Hours',
        duration: 200,
        cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&auto=format&fit=crop&q=80',
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=electronic-future-beats-117997.mp3',
        category: 'Pop',
        spotifyUrl: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b'
      },
      {
        id: 'cur-2',
        title: 'As It Was',
        artist: 'Harry Styles',
        album: "Harry's House",
        duration: 167,
        cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-study-112191.mp3',
        category: 'Pop',
        spotifyUrl: 'https://open.spotify.com/track/4LRPiXqCikLlN15c3yImP7'
      },
      {
        id: 'cur-3',
        title: 'Starboy (Synthwave Remix)',
        artist: 'The Weeknd ft. Daft Punk',
        album: 'Starboy',
        duration: 230,
        cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80',
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=tuesday-glitch-12278.mp3',
        category: 'Synthwave',
        spotifyUrl: 'https://open.spotify.com/track/7MXVkk9YM50ug0w6Gh29my'
      },
      {
        id: 'cur-4',
        title: 'Midnight City',
        artist: 'M83',
        album: 'Hurry Up, We\'re Dreaming',
        duration: 243,
        cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
        audioUrl: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_7314545532.mp3?filename=ambient-piano-amp-strings-10711.mp3',
        category: 'Electronic',
        spotifyUrl: 'https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt'
      },
      {
        id: 'cur-5',
        title: 'Night Changes (Acoustic)',
        artist: 'One Direction',
        album: 'FOUR',
        duration: 226,
        cover: 'https://images.unsplash.com/photo-1445985543469-433ecdd62977?w=500&auto=format&fit=crop&q=80',
        audioUrl: 'music/titanic.mp3',
        category: 'Acoustic',
        spotifyUrl: 'https://open.spotify.com/track/5O2P9iiztwhom9neueqw77'
      },
      {
        id: 'cur-6',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        album: '÷ (Divide)',
        duration: 233,
        cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=80',
        audioUrl: 'music/audio.mp3',
        category: 'Pop',
        spotifyUrl: 'https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3'
      },
      {
        id: 'cur-7',
        title: 'Levitating',
        artist: 'Dua Lipa',
        album: 'Future Nostalgia',
        duration: 203,
        cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=chill-abstract-intention-12099.mp3',
        category: 'Pop',
        spotifyUrl: 'https://open.spotify.com/track/463CkQjx2Zk1yXoBuEVd90'
      },
      {
        id: 'cur-8',
        title: 'Sunflower',
        artist: 'Post Malone, Swae Lee',
        album: 'Spider-Man: Into the Spider-Verse',
        duration: 158,
        cover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=80',
        audioUrl: 'music/lost.mp3',
        category: 'Hip-Hop',
        spotifyUrl: 'https://open.spotify.com/track/3KkXRkHbMCARz0aVfEt68P'
      }
    ];

    // Curated Playlists
    this.curatedPlaylists = [
      {
        id: 'pl-top-hits',
        name: 'Today\'s Top Hits',
        description: 'The biggest songs right now across the globe.',
        cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
        trackIds: ['cur-1', 'cur-2', 'cur-6', 'cur-7', 'local-1']
      },
      {
        id: 'pl-chill-vibes',
        name: 'Chill Lofi & Beats',
        description: 'Peaceful instrumental beats to relax, study, and code.',
        cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
        trackIds: ['local-2', 'cur-2', 'cur-4', 'local-3']
      },
      {
        id: 'pl-local-gems',
        name: 'Local Collection',
        description: 'High-fidelity audio files stored in your local music workspace.',
        cover: 'img/me.JPG',
        trackIds: ['local-1', 'local-2', 'local-3', 'local-4']
      },
      {
        id: 'pl-acoustic-guitar',
        name: 'Acoustic Guitar Favorites',
        description: 'Gentle acoustic strings, fingerstyle melodies and heartfelt covers.',
        cover: 'img/logo.jpeg',
        trackIds: ['local-3', 'local-4', 'cur-5', 'local-1']
      },
      {
        id: 'pl-synthwave',
        name: 'Synthwave & Retrowave',
        description: 'Neon synth basslines, driving 80s drums, and retro futurism.',
        cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80',
        trackIds: ['cur-3', 'cur-1', 'cur-4']
      }
    ];

    // Categories
    this.categories = [
      { id: 'cat-pop', name: 'Pop', color: '#8d67ab', cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80' },
      { id: 'cat-hiphop', name: 'Hip-Hop', color: '#bc5900', cover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&auto=format&fit=crop&q=80' },
      { id: 'cat-chill', name: 'Chill', color: '#d84000', cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80' },
      { id: 'cat-rock', name: 'Rock & Guitar', color: '#e91429', cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80' },
      { id: 'cat-electronic', name: 'Dance / EDM', color: '#006450', cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80' },
      { id: 'cat-acoustic', name: 'Acoustic', color: '#503750', cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80' }
    ];
  }

  async connect() {
    const response = await fetch(`${this.proxyUrl}/status`);
    const { configured } = await response.json();
    this.isDemoMode = !configured;
    return { success: configured, mode: configured ? 'live' : 'demo' };
  }

  // Spotify API Fetch Helper
  async request(endpoint) {
    const res = await fetch(`${this.proxyUrl}${endpoint}`);

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error?.message || `Spotify API error: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  }

  // Search API (Tracks, Artists, Albums)
  async search(query, types = 'track,artist,album') {
    if (!query || !query.trim()) return { tracks: [], artists: [], albums: [] };

    // If live token is active, query Spotify Web API
    if (!this.isDemoMode) {
      try {
        const data = await this.request(`/search?q=${encodeURIComponent(query)}&type=${types}&limit=20`);
        const formattedTracks = (data.tracks?.items || []).map(t => this.formatSpotifyTrack(t));
        const formattedArtists = (data.artists?.items || []).map(a => ({
          id: a.id,
          name: a.name,
          cover: a.images?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
          genres: a.genres || [],
          followers: a.followers?.total || 0,
          spotifyUrl: a.external_urls?.spotify
        }));
        const formattedAlbums = (data.albums?.items || []).map(al => ({
          id: al.id,
          name: al.name,
          artist: al.artists?.map(a => a.name).join(', ') || 'Unknown',
          cover: al.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
          releaseDate: al.release_date,
          totalTracks: al.total_tracks
        }));

        // Include matching local tracks
        const localMatches = this.getAllLocalAndCuratedTracks().filter(t => 
          t.title.toLowerCase().includes(query.toLowerCase()) || 
          t.artist.toLowerCase().includes(query.toLowerCase())
        );

        return {
          tracks: [...localMatches, ...formattedTracks],
          artists: formattedArtists,
          albums: formattedAlbums,
          isLive: true
        };
      } catch (err) {
        console.warn('Live Spotify search failed, returning local/curated search:', err);
      }
    }

    // Fallback search across local + curated catalog
    const q = query.toLowerCase();
    const all = this.getAllLocalAndCuratedTracks();
    const matchedTracks = all.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.artist.toLowerCase().includes(q) || 
      t.album.toLowerCase().includes(q)
    );

    const mockArtists = [
      { id: 'art-khup', name: 'Khup Muang', cover: 'img/me.JPG', genres: ['Pop', 'Acoustic Guitar'], followers: 15420 },
      { id: 'art-weeknd', name: 'The Weeknd', cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500', genres: ['R&B', 'Pop'], followers: 85200300 },
      { id: 'art-harry', name: 'Harry Styles', cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500', genres: ['Pop', 'Rock'], followers: 42300100 },
      { id: 'art-ed', name: 'Ed Sheeran', cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500', genres: ['Pop', 'Acoustic'], followers: 112000000 }
    ].filter(a => a.name.toLowerCase().includes(q) || a.genres.some(g => g.toLowerCase().includes(q)));

    return {
      tracks: matchedTracks,
      artists: mockArtists,
      albums: [],
      isLive: false
    };
  }

  // Browse New Releases
  async getNewReleases() {
    if (!this.isDemoMode && this.accessToken) {
      try {
        const data = await this.request('/browse/new-releases?limit=12');
        return (data.albums?.items || []).map(al => ({
          id: al.id,
          name: al.name,
          artist: al.artists?.map(a => a.name).join(', '),
          cover: al.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
          spotifyUrl: al.external_urls?.spotify
        }));
      } catch (err) {
        console.warn('Could not fetch new releases from Spotify API:', err);
      }
    }
    return this.curatedPlaylists;
  }

  // Format Spotify API Track object to Mini Spotify track model
  formatSpotifyTrack(t) {
    // If preview_url is null (Spotify deprecated 30s previews on some accounts), fallback gracefully to preview/local audio
    const fallbackAudio = this.getRandomAudioFallback();
    return {
      id: t.id,
      title: t.name,
      artist: t.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
      album: t.album?.name || 'Single',
      duration: Math.round((t.duration_ms || 180000) / 1000),
      cover: t.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
      audioUrl: t.preview_url || fallbackAudio,
      hasPreview: !!t.preview_url,
      spotifyUrl: t.external_urls?.spotify,
      popularity: t.popularity || 75
    };
  }

  getRandomAudioFallback() {
    const audioPool = [
      'music/audio.mp3',
      'music/lost.mp3',
      'music/thai.mp3',
      'music/titanic.mp3',
      'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=electronic-future-beats-117997.mp3',
      'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-study-112191.mp3'
    ];
    return audioPool[Math.floor(Math.random() * audioPool.length)];
  }

  // Get All Local & Curated Tracks
  getAllLocalAndCuratedTracks() {
    return [...this.localTracks, ...this.curatedTracks];
  }

  // Get Track by ID
  getTrackById(id) {
    return this.getAllLocalAndCuratedTracks().find(t => t.id === id) || null;
  }

  // Get Playlist by ID
  getPlaylistById(id) {
    const pl = this.curatedPlaylists.find(p => p.id === id);
    if (!pl) return null;
    const tracks = pl.trackIds.map(tid => this.getTrackById(tid)).filter(Boolean);
    return { ...pl, tracks };
  }
}

// Export singleton instance
window.spotifyAPI = new SpotifyAPI();
