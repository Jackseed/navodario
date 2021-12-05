import { getSpotifyAuthHeaders } from './spotify-auth';
const axios = require('axios').default;

//--------------------------------
//    Delete playlist tracks    //
//--------------------------------
// Deletes all the tracks from a Spotify playlist.
export async function deletePlaylistTracks(req: any, res: any) {
  const headers = await getSpotifyAuthHeaders();
  const uris = req.body.uris;
  const playlistId = req.body.playlistId;
  const tracksLimit = 100;
  let batchRequests: Promise<Object>[] = [];
  // Deletes tracks from playlist.
  if (uris.length > 0) {
    // Creates batches of requests to respect Spotify limit.
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

    // Sends requests.
    await Promise.all(
      batchRequests.map(async (request) => {
        return await request
          .then((response: any) => {
            console.log('response status: ', response.status);
          })
          .catch((error: any) => {
            console.log(error.response.data);
          });
      })
    )
      .then(() => {
        console.log(
          `${uris.length} tracks deleted from playlist ${playlistId}`
        );
      })
      .catch((err) =>
        console.log('something went wrong.. ', err.response.data)
      );
  }

  res.status(200).send();

  return res;
}
