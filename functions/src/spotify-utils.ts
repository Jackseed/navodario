import functions = require('firebase-functions');
const axios = require('axios').default;
import { getSpotifyAuthHeaders } from './spotify-auth';

//--------------------------------
//   Saves tracks to playlist   //
//--------------------------------
export async function saveTracksToPlaylist(
  headers: Object,
  playlistId: string,
  uris: string[]
): Promise<string> {
  let res = '';
  // Adds tracks to the playlist.
  if (uris.length > 0) {
    await axios({
      method: 'POST',
      headers,
      url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      data: {
        uris: uris,
      },
    }).then(
      (response: any) => {
        console.log('response status: ', response.status);
        res = `response status: ${response.status}`;
      },
      (error: any) => {
        console.log(error.response.data);
        res = `error: ${error}`;
      }
    );
  }
  return res;
}

//--------------------------------
// Gets playlist last trackids  //
//--------------------------------
export async function getPlaylistLastTrackIds(
  headers: Object,
  playlistId: string,
  limit: number
): Promise<string[]> {
  // Gets playlist total track number.
  let playlistTrackTotal = 0;
  await axios({
    headers,
    url: `https://api.spotify.com/v1/playlists/${playlistId}`,
  }).then((response: any) => {
    playlistTrackTotal = response.data.tracks.total;
  });

  // Then calls the last tracks from Spotify.
  const offset =
    playlistTrackTotal - limit > 0 ? playlistTrackTotal - limit : 0;
  const lastTracks: any[] = [];
  await axios({
    headers,
    url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
  }).then(
    (response: any) => {
      lastTracks.push(response.data.items);
    },
    (error: any) => {
      console.log(error.response.data);
    }
  );

  // Formats track ids.
  const lastTrackIds = lastTracks.map((track) => {
    return track.map((t: any) => t.track.id);
  })[0];

  return lastTrackIds;
}

//--------------------------------
//     Gets playlist tracks     //
//--------------------------------
/// TODO: remove save tracks fuction call from this function
export async function getPlaylistTracks(req: any, res: any) {
  const headers = await getSpotifyAuthHeaders();
  const playlistId = req.body.playlistId;
  let playlist: any;

  // Gets the playlist to know total track number.
  await axios({
    headers,
    url: `https://api.spotify.com/v1/playlists/${playlistId}`,
  })
    .then((response: any) => {
      playlist = response.data;
    })
    .catch((error: any) => console.log(error.response.data));

  let allPlaylistTracks: any[] = [];
  const playlistTracksLimit = 100;
  const requestArray: any[] = [];
  // Minimizes the calls needed to what will be saved, -1 is here to compensate the array starting to 0.
  const totalTracksCalled: number =
    req.body.start - req.body.end
      ? Math.min(playlist.tracks.total, req.body.end - req.body.start) - 1
      : playlist.tracks.total;

  if (playlist) {
    // Creates all the requests to get the playlist tracks within API limits.
    for (
      let i = 0;
      // Checks if it's the last tracks of the array, if it is then adds 1 to get what's left.
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

  // Sends all the requests at once.
  await Promise.all(
    requestArray.map(async (request, index) => {
      return await request
        .then((response: any) => {
          const playlistTracks: any = response.data;
          const tracks: any[] = [];
          // Extracts needed track info.
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
        .catch((err: any) =>
          console.log('Something broke: ', err.response.data)
        );
    })
  )
    .then(() => {
      console.log('All batch loaded.');
    })
    .catch((err) => console.log('something went wrong.. ', err.response.data));

  if (req.body.start - req.body.end)
    allPlaylistTracks = allPlaylistTracks.slice(req.body.start, req.body.end);
  // Saves tracks to Firestore.
  await axios({
    headers: {
      'Content-Type': 'application/json',
    },
    url: functions.config().functions.savetracks,
    data: {
      tracks: allPlaylistTracks,
    },
    method: 'POST',
  }).catch((error: any) => console.log(error.response.data));

  // Extracts uris for deleting afterwards.
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
}
