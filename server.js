require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const spotifyApiUrl = 'https://api.spotify.com/v1';
const spotifyAuthUrl = 'https://accounts.spotify.com/api/token';
let accessToken = '';
let tokenExpiresAt = 0;

async function getSpotifyToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;

  const { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret } = process.env;
  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials are missing. Add them to .env.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(spotifyAuthUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || 'Spotify authentication failed.');

  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + Math.max(data.expires_in - 60, 0) * 1000;
  return accessToken;
}

app.get('/api/spotify/status', (_req, res) => {
  const configured = Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
  res.json({ configured });
});

app.get('/api/spotify/*', async (req, res) => {
  try {
    const token = await getSpotifyToken();
    const endpoint = req.originalUrl.replace('/api/spotify', '');
    const response = await fetch(`${spotifyApiUrl}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: { message: error.message } });
  }
});

app.use(express.static(path.join(__dirname)));
app.listen(port, () => console.log(`Mini Spotify is running at http://localhost:${port}`));