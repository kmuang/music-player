// Browser storage for audio files imported by the user.
// Audio blobs live in IndexedDB; localStorage is intentionally not used for file data.
class LocalLibrary {
  constructor() {
    this.databaseName = 'mini-spotify-library';
    this.storeName = 'tracks';
    this.databasePromise = null;
  }

  open() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB is unavailable in this browser.'));
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 2);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.storeName)) {
          database.createObjectStore(this.storeName, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('artwork')) {
          database.createObjectStore('artwork', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open the music library.'));
      request.onblocked = () => reject(new Error('Close other tabs using the music library, then try again.'));
    });
    return this.databasePromise;
  }

  async getAll() {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const request = database.transaction(this.storeName, 'readonly').objectStore(this.storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Could not read saved tracks.'));
    });
  }

  async get(id) {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const request = database.transaction(this.storeName, 'readonly').objectStore(this.storeName).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Could not read the saved track.'));
    });
  }

  async saveMany(tracks) {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      tracks.forEach(track => store.put(track));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not save audio files.'));
      transaction.onabort = () => reject(transaction.error || new Error('Saving audio files was cancelled.'));
    });
  }

  async deleteTrack(id) {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(this.storeName, 'readwrite');
      transaction.objectStore(this.storeName).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not remove the saved track.'));
      transaction.onabort = () => reject(transaction.error || new Error('Removing the saved track was cancelled.'));
    });
  }

  async saveArtwork(id, blob) {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('artwork', 'readwrite');
      transaction.objectStore('artwork').put({ id, blob });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not save playlist artwork.'));
      transaction.onabort = () => reject(transaction.error || new Error('Saving playlist artwork was cancelled.'));
    });
  }

  async getAllArtwork() {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const request = database.transaction('artwork', 'readonly').objectStore('artwork').getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Could not load playlist artwork.'));
    });
  }
}

window.localLibrary = new LocalLibrary();
