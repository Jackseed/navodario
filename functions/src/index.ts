/* eslint-disable */
const functions = require('firebase-functions');
const axios = require('axios').default;

/////////////////////// HEADERS FOR SPOTIFY API ///////////////////////
// refresh access token
async function getSpotifyAuthHeaders(): Promise<Object> {
  // encode secrets
  const secret = Buffer.from(
    `${functions.config().spotify.clientid}:${
      functions.config().spotify.clientsecret
    }`
  ).toString('base64');

  // use a refresh token manually get beforehand
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

/////////////////////// GET PLAYLIST LAST TRACK IDS ///////////////////////
exports.getPlaylistTracks = functions
  .runWith({
    timeoutSeconds: 500,
  })
  .https.onRequest(async (req: any, res: any) => {
    const headers = await getSpotifyAuthHeaders();
    const playlistId = req.body.playlistId;
    let playlist: any;

    await axios({
      headers,
      url: `https://api.spotify.com/v1/playlists/${playlistId}`,
    })
      .then((response: any) => {
        playlist = response.data;
      })
      .catch((error: any) => console.log(error));

    res.json({
      result: `Tracks successfully saved from playlistId, total tracks: ${playlist.tracks.total}.`,
    });
    /*
    let allPlaylistTracks: any[] = [];
    const playlistTracksLimit = 100;
    let requestArray: any[] = [];

    if (playlist) {
      // create all the requests to get the playlist tracks within API limits
      for (
        let i = 0;
        i <= Math.floor(playlist.tracks.total / playlistTracksLimit) + 1;
        i++
      ) {
        const offset = i * playlistTracksLimit;
        const url = playlist.tracks.href;
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
            playlistTracks.items.map((item: any) => {
              return {
                added_at: item.added_at,
                ...item.track,
              };
            });

            allPlaylistTracks.push(playlistTracks);

            console.log(`loading batch ${index}`);
          })
          .catch((err: any) => console.log('Something broke!', err));
      })
    )
      .then(() => {
        console.log('All batch loaded!');
      })
      .catch((err) => console.log('something went wrong.. ', err));

    const trackIds = allPlaylistTracks.map((track) => {
      return track.map((t: any) => t.track.id);
    });

    console.log('trackIds: ', trackIds);

    res.json({
      result: `Tracks successfully saved from playlistId ${playlistId}.`,
    }); */
  });
