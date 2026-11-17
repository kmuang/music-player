# Mini Spotify

A personal music player in the browser. It plays the MP3 files in this project, keeps liked songs and playlists in the browser, and can search Spotify when the server has API credentials.

The live site is [https://kmspotify.netlify.app/](https://kmspotify.netlify.app/). That site only changes after a new Netlify deploy. Adding a file on this computer does not update it by itself.

## Run it locally

You need Node.js.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

`npm start` runs `server.js`. The server serves this folder as a website and, when configured, proxies Spotify search so the client secret stays on the server. Without Spotify credentials the player still works. It uses the local song list and shows demo mode.

The port defaults to `3000`. Set `PORT` in `.env` to use another port.


## What you can do in the app

- Play, pause, skip, seek, shuffle, and repeat.
- Like songs. Likes are stored in `localStorage`.
- Search the local catalog. Live Spotify search is added when the server has credentials.
- Switch between light and dark themes. The choice is saved in the browser.
- Open the queue and the frequency visualizer.
- Create your own playlists, rename them, and set custom artwork. Artwork is stored in IndexedDB.
- Drag MP3 or WAV files onto the page. Those imports stay in this browser only. They are not copied into the `music` folder and they are not part of the folder playlists.

### Keyboard shortcuts

These work when you are not typing in a text field.

| Key | Action |
| --- | --- |
| Space | Play or pause |
| Left arrow | Back 5 seconds |
| Right arrow | Forward 5 seconds |
| Up arrow | Volume up |
| Down arrow | Volume down |
| M | Mute or unmute |
| L | Like or unlike the current song |

## Song folders

Every bundled song is an MP3 under `music/`. The player does not scan the folders. `js/spotify-api.js` lists the filenames, and `js/app.js` builds one playlist per folder from that list.

Use plain ASCII filenames. Letters, numbers, hyphens, and dots are safe. Emoji, spaces, and other special characters play on macOS and then 404 on GitHub Pages and Netlify, because those hosts run on Linux.

| Folder | Playlist | What goes here |
| --- | --- | --- |
| `music/` | Home and, for Titanic, Guitar Solo | `lost.mp3`, `thai.mp3`, `titanic.mp3` |
| `music/guitar-solo/` | Guitar Solo | Guitar recordings. `titanic.mp3` is also included because its category is Guitar. |
| `music/international/` | International | One file per track, named in English (`france.mp3`, `norway-2.mp3`, and so on). |
| `music/zomi/` | Zomi | Zomi songs. The filename without `.mp3` goes in the `zomiSongs` array. |
| `music/myanmar/` | Myanmar | Myanmar songs. The filename without `.mp3` goes in the `myanmarSongs` array. |
| `music/library/` | Library | Everything else. The filename without `.mp3` goes in the `librarySongs` array. |

Titles are generated from the filename. `phephe-taduh` becomes **Phephe Taduh**. The artist shown for bundled songs is Khup Muang.

An empty folder removes its playlist. Gospel is wired up in `js/app.js`, but there is no `music/gospel/` folder right now, so the Gospel playlist is not shown.

Current catalog size: 96 local tracks. Library has 52. Zomi has 14. Myanmar has 12. International has 8. Guitar Solo has 8, counting Titanic plus the 7 files in `music/guitar-solo/`.

## Add or remove a song

1. Put the MP3 in the matching folder. Example: `music/library/new-song.mp3`.
2. Add the filename without `.mp3` to the matching list in `js/spotify-api.js`.
   - Library songs go in `librarySongs`.
   - Zomi songs go in `zomiSongs`.
   - Myanmar songs go in `myanmarSongs`.
   - Guitar and International tracks are individual objects near the top of `localTracks`, because each one has its own display title.
3. If you removed a file, delete that name from the same list. A name with no file shows up in the playlist and fails when you press play.
4. Refresh the browser. Folder playlists are rewritten from the current list, so old names drop out.

Imported files dropped onto the page are separate. To remove one of those, use the remove button on the track. That deletes it from IndexedDB in this browser only.

The player plays the file URL on the site. It does not keep a private copy of folder songs, so replacing an MP3 and refreshing plays the new file.

## Project files

| Path | Role |
| --- | --- |
| `index.html` | Page structure. It does not list songs. |
| `css/style.css` | Layout and theme. |
| `js/spotify-api.js` | Song catalog, Spotify search client, and demo tracks. |
| `js/app.js` | Screens, playlists, likes, search, and imports. |
| `js/player.js` | Audio playback, queue, seek, volume, and visualizer. |
| `js/local-library.js` | IndexedDB storage for imported audio and playlist artwork. |
| `server.js` | Local static server and Spotify token proxy. |
| `img/` | Logo, avatar, and playlist covers. |
| `.nojekyll` | Tells GitHub Pages to publish the files as-is, including MP3s. |
| `.env.example` | Variable names for Spotify credentials. |

## Deploy

Publish the whole project folder, including `music/`, the `js` files, and `.nojekyll`. Publishing only the JavaScript updates the song names and leaves the audio missing.

Netlify site: [https://kmspotify.netlify.app/](https://kmspotify.netlify.app/).

For a manual Netlify update, open that site, go to **Deploys**, and drop this project folder on the deploy area. You can leave `node_modules` out. After the deploy finishes, hard-refresh the site.

GitHub Pages also works as a static site because of `.nojekyll`. The Node server does not run there, so Spotify search stays in demo mode. Keep audio filenames in ASCII.

If a song plays locally and fails on the deployed site, the usual cause is that the new MP3 or the updated `js/spotify-api.js` was not in that deploy.
