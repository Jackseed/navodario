/* eslint-disable */
import admin = require('firebase-admin');

//--------------------------------
//   Saves tracks to Firestore  //
//--------------------------------
// Saves tracks to Firestore 'tracks' collection.
export async function saveTracks(req: any, res: any) {
  const tracks = req.body.tracks;
  const firebaseWriteLimit = 500;
  console.log('total tracks saving: ', tracks.length);
  for (let i = 0; i <= Math.floor(tracks.length / firebaseWriteLimit); i++) {
    const bactchTracks = tracks.slice(
      firebaseWriteLimit * i,
      firebaseWriteLimit * (i + 1)
    );
    const batch = admin.firestore().batch();
    for (const track of bactchTracks) {
      if (track) {
        const ref = admin.firestore().collection('tracks').doc();
        batch.set(ref, track, { merge: true });
      }
    }

    await batch
      .commit()
      .then((_: any) => console.log(`batch of ${i} saved`))
      .catch((error: any) => console.log(error.response.data));
  }
  res.json({
    result: `Tracks successfully saved on Firestore, total tracks: ${tracks.length}.`,
  });

  return res;
}

//--------------------------------
//   Saves token to Firestore  //
//--------------------------------
// Saves Spotify access or refresh token to Firestore 'user' document.
export async function saveToken(req: any, res: any) {
  const accessToken = req.body.token;
  if (accessToken) {
    let tokens: { access: string; addedTime: Object; refresh?: string } = {
      access: accessToken,
      addedTime: admin.firestore.FieldValue.serverTimestamp(),
    };
    // Adds refresh token only when requesting an access token for the first time.
    if (req.body.tokenType === 'access')
      tokens = { ...tokens, refresh: req.body.refreshToken };

    await admin.firestore().collection('users').doc(req.body.userId).set(
      {
        tokens,
      },
      { merge: true }
    );

    res.json({ result: `Access token successfully added: ${accessToken}.` });
  } else {
    res.json({ result: `Empty token.` });
  }
}
