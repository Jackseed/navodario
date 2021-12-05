import functions = require('firebase-functions');
import admin = require('firebase-admin');
import { deletePlaylistTracks } from './delete-playlist-tracks';
import {
  scrapeAndSaveAllNovaChannels,
  saveNovaOnSpotify,
} from './nova-scraping';
import { saveAndRestore } from './save-and-restore';
import { getPlaylistTracks } from './spotify-utils';
import { saveTracks, saveToken } from './firestore-utils';
import { getSpotifyToken } from './spotify-auth';
const serviceAccount = require(functions.config().internal.id);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.GCLOUD_PROJECT}.firebaseio.com`,
});

//--------------------------------
//    Saves Nova every 5min     //
//--------------------------------
/// Pubsub: Scraps and saves all nova channels every 5 minutes.
exports.saveNovaEveryFiveMinutes = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(scrapeAndSaveAllNovaChannels);

/// On request
exports.saveNova = functions
  .runWith({
    timeoutSeconds: 500,
  })
  .https.onRequest(scrapeAndSaveAllNovaChannels);

//--------------------------------
// Restores playlists every day //
//--------------------------------
// Saves every nova playlists tracks to Firestore.
// Then restore the playlists, every day at 06:00 AM CET.
// Pubsub
exports.saveAndRestoreNovaEveryDay = functions
  .runWith({
    timeoutSeconds: 500,
  })
  .pubsub.schedule('0 06 * * *')
  .timeZone('Europe/Paris')
  .onRun(saveAndRestore);

// On request
exports.saveAndRestoreNova = functions
  .runWith({
    timeoutSeconds: 500,
  })
  .https.onRequest(saveAndRestore);

//--------------------------------
//    Saves Nova to Spotify     //
//--------------------------------
exports.saveNovaOnSpotify = functions
  .runWith({
    timeoutSeconds: 500,
    memory: '512MB',
  })
  .https.onRequest(saveNovaOnSpotify);

//--------------------------------
// Deletes tracks from playlist //
//--------------------------------
exports.deletePlaylistTracks = functions
  .runWith({
    timeoutSeconds: 500,
  })
  .https.onRequest(deletePlaylistTracks);

//--------------------------------
//   Saves tracks to Firestore  //
//--------------------------------
exports.saveTracks = functions
  .runWith({
    timeoutSeconds: 500,
  })
  .https.onRequest(saveTracks);

//--------------------------------
//   Saves token to Firestore   //
//--------------------------------
exports.saveToken = functions
  .runWith({
    timeoutSeconds: 60,
  })
  .https.onRequest(saveToken);

//--------------------------------
//   Gets tracks from playlist  //
//--------------------------------
exports.getPlaylistTracks = functions
  .runWith({
    timeoutSeconds: 500,
  })
  .https.onRequest(getPlaylistTracks);

//--------------------------------
//      Gets Spotify token      //
//--------------------------------
exports.getSpotifyToken = functions
  .runWith({
    timeoutSeconds: 50,
  })
  .https.onCall(getSpotifyToken);
