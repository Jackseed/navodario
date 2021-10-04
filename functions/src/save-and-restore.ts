/* eslint-disable */
import { nova } from './data/types';
const axios = require('axios').default;

//--------------------------------
//      Save and Restore        //
//--------------------------------
// Saves the tracks from all nova Spotify playlists to Firestore.
// Then deletes all tracks within playlists.
export async function saveAndRestore(): Promise<any> {
  const playlistUris: any = {};
  // Instantiates an empty uri array per channel
  nova.map((channel) => (playlistUris[channel.playlistId] = []));

  // Creates a request per channel to get tracks & save it to Firestore.
  const savingRequestArray = nova.map((channel: any) => {
    const request = axios({
      headers: {
        'Content-Type': 'application/json',
      },
      url: 'https://us-central1-nova-jukebox.cloudfunctions.net/getPlaylistTracks',
      data: {
        playlistId: channel.playlistId,
        novaChannel: channel.novaChannel,
      },
      method: 'POST',
    });

    return request;
  });
  // Sends all the requests at once.
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
        .catch((err: any) => console.log('Something broke: ', err.response.data));
    })
  )
    .then(async () => {
      console.log(
        'Every playlist tracks saved to firestore. Start of delete operation.'
      );
      // Tracks are saved to Firestore, now deletes it from Spotify.
      const deletingRequestArray = nova.map((channel: any) => {
        const request = axios({
          headers: {
            'Content-Type': 'application/json',
          },
          url: 'https://us-central1-nova-jukebox.cloudfunctions.net/deleteTracks',
          data: {
            playlistId: channel.playlistId,
            uris: playlistUris[channel.playlistId],
          },
          method: 'POST',
        });

        return request;
      });
      // Sends all requests at once
      await Promise.all(
        deletingRequestArray.map(async (request: any) => {
          return await request
            .then((response: any) => {
              console.log(`tracks deleted.`);
            })
            .catch((err: any) =>
              console.log('Something broke when deleting: ', err.response.data)
            );
        })
      )
        .then(() => {
          console.log('Every playlist tracks deleted.');
        })
        .catch((err) =>
          console.log('something went wrong when trying to delete.. ', err.response.data)
        );
    })
    .catch((err) => console.log('something went wrong.. ', err.response.data));
}
