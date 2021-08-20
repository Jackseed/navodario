/* eslint-disable */
const functions = require('firebase-functions');
const axios = require('axios').default;
const axiosRetry = require('axios-retry');
axiosRetry(axios, {
  retries: 3,
});
const admin = require('firebase-admin');
admin.initializeApp();

const nova = [
  {
    novaChannel: 'Radio Nova',
    playlistId: '6GhFJfQ9pTY578m3l3CfOd',
  },/*
  {
    novaChannel: 'Nouvo nova',
    playlistId: '22x26Yktyw49iHcC5l0GOR',
  },
  {
    novaChannel: 'Nova la nuit',
    playlistId: '5IWE2zzGBxQmf1g3aI2sFa',
  },
  {
    novaChannel: 'Nova classics',
    playlistId: '013LrKxrQkVpoJTts6gin3',
  },
  {
    novaChannel: 'Nova danse',
    playlistId: '24WXdbI5caT1TZKlipmxzE',
  }, */
];

/// PUB SUB JOB
export const saveAndDeleteNovaEveryWeek = functions
  .runWith({
    timeoutSeconds: 500,
  })
  .https.onRequest(async (req: any, res: any) => /* .pubsub
  .schedule('every Monday 00:00 AM')
  .onRun(async (req: any, res: any)  */ {
    const playlistUris: any = {};
    // instantiate an empty uri array per radio
    nova.map((radio) => (playlistUris[radio.playlistId] = []));

    // create a request per radio to get tracks & save it to firestore
    const savingRequestArray = nova.map((radio: any) => {
      const request = axios({
        headers: {
          'Content-Type': 'application/json',
        },
        url: 'http://localhost:5001/nova-jukebox/us-central1/getPlaylistTracks',
        data: {
          playlistId: radio.playlistId,
          novaChannel: radio.novaChannel,
        },
        method: 'POST',
      });

      return request;
    });
    // send requests
    await Promise.all(
      savingRequestArray.map(async (request: any) => {
        return await request
          .then((response: any) => {
            playlistUris[response.data.playlistId] = playlistUris[
              response.data.playlistId
            ].concat(response.data.uris);
            console.log(
              `${playlistUris[response.data.playlistId].length} tracks saved.`
            );
          })
          .catch((err: any) => console.log('Something broke: ', err));
      })
    )
      .then(async () => {
        console.log(
          'Every playlist tracks saved to firestore. Start of delete operation.'
        );
        // Tracks saved to Firestore, now delete it from Spotify
        const deletingRequestArray = nova.map((radio: any) => {
          const request = axios({
            headers: {
              'Content-Type': 'application/json',
            },
            url: 'http://localhost:5001/nova-jukebox/us-central1/deleteTracks',
            data: {
              playlistId: radio.playlistId,
              uris: playlistUris[radio.playlistId],
            },
            method: 'POST',
          });

          return request;
        });
        // send requests
        await Promise.all(
          deletingRequestArray.map(async (request: any) => {
            return await request
              .then((response: any) => {
                console.log(`tracks deleted.`);
              })
              .catch((err: any) =>
                console.log('Something broke when deleting: ', err)
              );
          })
        )
          .then(() => {
            console.log('Every playlist tracks deleted.');
          })
          .catch((err) =>
            console.log('something went wrong when trying to delete.. ', err)
          );
      })
      .catch((err) => console.log('something went wrong.. ', err));

    res.json({
      result: `Tracks saved and deleted.`,
    });
  });

/////////////////////// HEADERS FOR SPOTIFY API ///////////////////////
// refresh access token
async function getSpotifyAuthHeaders(): Promise<Object> {
  // encode secrets
  const secret = Buffer.from(
    `${functions.config().spotify.clientid}:${
      functions.config().spotify.clientsecret
    }`
  ).toString('base64');

  // use a refresh token manually created beforehand
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', functions.config().spotify.refreshtoken);

  const config = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${secret}`,
    },
  };

  let token = '';
  // request a fresh access token
  await axios
    .post('https://accounts.spotify.com/api/token', params, config)
    .then(
      (response: any) => {
        token = response.data.access_token;
      },
      (error: any) => {
        console.log('error: ', error);
      }
    );

  // build api call header
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  return headers;
}

/// TODO: remove save tracks fuction call from this function
/////////////////////// GET PLAYLIST TRACKS ///////////////////////
exports.getPlaylistTracks = functions
  .runWith({
    timeoutSeconds: 500,
  })
  .https.onRequest(async (req: any, res: any) => {
    const headers = await getSpotifyAuthHeaders();
    const playlistId = req.body.playlistId;
    let playlist: any;

    // get the playlist to know total track number
    await axios({
      headers,
      url: `https://api.spotify.com/v1/playlists/${playlistId}`,
    })
      .then((response: any) => {
        playlist = response.data;
      })
      .catch((error: any) => console.log(error));

    let allPlaylistTracks: any[] = [];
    const playlistTracksLimit = 100;
    const requestArray: any[] = [];
    // minimize the calls needed to what will be saved, -1 is here to compensate the array starting to 0
    const totalTracksCalled: number =
      req.body.start - req.body.end
        ? Math.min(playlist.tracks.total, req.body.end - req.body.start) - 1
        : playlist.tracks.total;

    if (playlist) {
      // create all the requests to get the playlist tracks within API limits
      for (
        let i = 0;
        // check if it's the last tracks of the array, if it is then adds 1 to get what's left
        totalTracksCalled % playlistTracksLimit == 0
          ? i <= Math.floor(totalTracksCalled / playlistTracksLimit)
          : i <= Math.floor(totalTracksCalled / playlistTracksLimit) + 1;
        i++
      ) {
        const offset = i * playlistTracksLimit;

        const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
        const queryParam = `?limit=${playlistTracksLimit}&offset=${offset}`;

        const request = axios({
          headers,
          url: `${url + queryParam}`,
          method: 'GET',
        });
        requestArray.push(request);
      }
    }

    // send all the requests
    await Promise.all(
      requestArray.map(async (request, index) => {
        return await request
          .then((response: any) => {
            const playlistTracks: any = response.data;
            const tracks: any[] = [];
            // extract needed track info
            playlistTracks.items.map((item: any) => {
              tracks.push({
                added_at: item.added_at ? item.added_at : '',
                added_at_day: item.added_at
                  ? new Date(item.added_at).getDay()
                  : null,
                added_at_hours: item.added_at
                  ? new Date(item.added_at).getHours()
                  : null,
                name: item.track.name ? item.track.name : '',
                uri: item.track.uri ? item.track.uri : '',
                spotifyId: item.track.id ? item.track.id : '',
                duration_ms: item.track.duration_ms
                  ? item.track.duration_ms
                  : null,
                artist: item.track.artists[0].name
                  ? item.track.artists[0].name
                  : '',
                album: item.track.album.name ? item.track.album.name : '',
                image: item.track.album.images[0].url
                  ? item.track.album.images[0].url
                  : '',
                nova_channel: req.body.novaChannel,
              });
            });

            allPlaylistTracks = allPlaylistTracks.concat(tracks);

            console.log(`loading batch ${index}`);
          })
          .catch((err: any) => console.log('Something broke: ', err));
      })
    )
      .then(() => {
        console.log('All batch loaded.');
      })
      .catch((err) => console.log('something went wrong.. ', err));

    if (req.body.start - req.body.end)
      allPlaylistTracks = allPlaylistTracks.slice(req.body.start, req.body.end);
    // save tracks on firestore
    await axios({
      headers: {
        'Content-Type': 'application/json',
      },
      url: 'https://us-central1-nova-jukebox.cloudfunctions.net/saveTracks',
      data: {
        tracks: allPlaylistTracks,
      },
      method: 'POST',
    }).catch((err: any) => console.log('error: ', err));

    // extract uris for deleting afterwards
    const uris = allPlaylistTracks.map((track) => {
      const uri = { uri: track.uri };
      return uri;
    });

    res.json({
      result: `Tracks successfully saved from playlistId, total tracks: ${allPlaylistTracks.length}.`,
      uris,
      playlistId,
    });

    return res;
  });

/////////////////////// SAVE TRACKS TO FIREBASE ///////////////////////
exports.saveTracks = functions
  .runWith({
    timeoutSeconds: 500,
  })
  .https.onRequest(async (req: any, res: any) => {
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
        .catch((error: any) => console.log(error));
    }
    res.json({
      result: `Tracks successfully saved on Firestore, total tracks: ${tracks.length}.`,
    });

    return res;
  });

/////////////////////// DELETE TRACKS FROM SPOTIFY PLAYLIST ///////////////////////
exports.deleteTracks = functions
  .runWith({
    timeoutSeconds: 500,
  })
  .https.onRequest(async (req: any, res: any) => {
    const headers = await getSpotifyAuthHeaders();
    const uris = req.body.uris;
    const playlistId = req.body.playlistId;
    const tracksLimit = 100;
    let batchRequests: Promise<Object>[] = [];

    // delete tracks from playlist
    if (uris.length > 0) {
      //create batches of requests to respect Spotify limit
      for (let i = 0; i <= Math.floor(uris.length / tracksLimit); i++) {
        const bactchUris = uris.slice(tracksLimit * i, tracksLimit * (i + 1));
        console.log(
          `creating delete request for ${bactchUris.length} tracks out of ${uris.length}.`
        );
        const request = axios.delete(
          `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
          {
            headers,
            data: {
              tracks: bactchUris,
            },
          }
        );
        batchRequests = batchRequests.concat(request);
      }

      // send requests
      await Promise.all(
        batchRequests.map(async (request) => {
          return await request
            .then((response: any) => {
              console.log('response status: ', response.status);
            })
            .catch((err: any) => {
              console.log('error: ', err);
            });
        })
      )
        .then(() => {
          console.log(
            `${uris.length} tracks deleted from playlist ${playlistId}`
          );
        })
        .catch((err) => console.log('something went wrong.. ', err));
    }

    res.status(200).send();

    return res;
  });

////////////////// REQUEST SPOTIFY REFRESH OR ACCESS TOKENS //////////////////
exports.getSpotifyToken = functions
  .runWith({
    timeoutSeconds: 50,
  })
  .https.onCall(async (data: any, context: any) => {
    const secret = Buffer.from(
      `${functions.config().spotify.clientid}:${
        functions.config().spotify.clientsecret
      }`
    ).toString('base64');

    const params = new URLSearchParams();
    // same function for either getting an access & refresh tokens (through code, tokenType access) or an access token through refresh token
    if (data.tokenType === 'access') {
      params.append('grant_type', 'authorization_code');
      params.append('code', data.code);
      // this redirect_uri must be exactly the same as used in environment.(prod).ts
      params.append('redirect_uri', 'http://localhost:4200');
    } else {
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', data.refreshToken);
    }

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${secret}`,
      },
    };

    let token = '';
    let refresh_token = '';

    await axios
      .post('https://accounts.spotify.com/api/token', params, config)
      .then(
        (response: any) => {
          token = response.data.access_token;
          if (data.tokenType === 'access') {
            refresh_token = response.data.refresh_token;
            console.log(refresh_token);
          }
        },
        (error: any) => {
          console.log('error: ', error);
        }
      );

    // save tokens on db
    await axios({
      headers: {
        'Content-Type': 'application/json',
      },
      url: 'https://us-central1-nova-jukebox.cloudfunctions.net/saveToken',
      data: {
        token,
        refreshToken: refresh_token,
        tokenType: data.tokenType,
        userId: data.userId,
      },
      method: 'POST',
    }).catch((err: any) => console.log('error: ', err));

    return { token, refresh_token };
  });

exports.saveToken = functions
  .runWith({
    timeoutSeconds: 60,
  })
  .https.onRequest(async (req: any, res: any) => {
    const accessToken = req.body.token;
    if (accessToken) {
      let tokens: { access: string; addedTime: Object; refresh?: string } = {
        access: accessToken,
        addedTime: admin.firestore.FieldValue.serverTimestamp(),
      };
      // add refresh token only when requesting an access token for the first time
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
  });
