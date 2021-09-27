/* eslint-disable */
import functions = require('firebase-functions');
import { createFirebaseAccount } from './firestore-utils';
const axios = require('axios').default;

//--------------------------------
//    Requests Spotify token    //
//--------------------------------
// Gets either an access or refresh Spotify token.
export async function getSpotifyToken(data: any) {
  const secret = Buffer.from(
    `${functions.config().spotify.clientid}:${
      functions.config().spotify.clientsecret
    }`
  ).toString('base64');

  const params = new URLSearchParams();
  // Parameters change whether it's an access or a refresh token.
  if (data.tokenType === 'access') {
    params.append('grant_type', 'authorization_code');
    params.append('code', data.code);
    params.append('redirect_uri', functions.config().spotify.redirecturi);
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
  let custom_auth_token = '';
  let userId = data.userId ? data.userId : '';

  // Requests token to Spotify.
  await axios
    .post('https://accounts.spotify.com/api/token', params, config)
    .then(
      (response: any) => {
        token = response.data.access_token;
        if (data.tokenType === 'access') {
          refresh_token = response.data.refresh_token;
        }
      },
      (error: any) => {
        console.log('error: ', error.response.data);
      }
    );

  // Refresh token means first connexion.
  if (refresh_token) {
    // Create a user based on Spotify user info.
    await axios
      .get('https://api.spotify.com/v1/me', {
        headers: { Authorization: 'Bearer ' + token },
      })
      .then(async (response: any) => {
        const uid = response.data.id;
        const displayName = response.data.display_name;
        const email = response.data.email;
        userId = uid;

        custom_auth_token = await createFirebaseAccount(
          uid,
          displayName,
          email
        );
      })
      .catch((error: any) => console.log(error));
  }

  // Saves tokens on Firestore.
  await axios({
    headers: {
      'Content-Type': 'application/json',
    },
    url: functions.config().spotify.savetokenfunction,
    data: {
      token,
      refreshToken: refresh_token,
      tokenType: data.tokenType,
      userId,
    },
    method: 'POST',
  }).catch((err: any) => console.log('error: ', err));

  return { token, refresh_token, custom_auth_token };
}

//--------------------------------
//     Spotify Auth Header      //
//--------------------------------
// Refreshes an access token then creates the header.
export async function getSpotifyAuthHeaders(): Promise<Object> {
  // Encodes secrets.
  const secret = Buffer.from(
    `${functions.config().spotify.clientid}:${
      functions.config().spotify.clientsecret
    }`
  ).toString('base64');

  // Uses a refresh token manually created beforehand.
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
  // Requests a fresh access token.
  await axios
    .post('https://accounts.spotify.com/api/token', params, config)
    .then(
      (response: any) => {
        token = response.data.access_token;
      },
      (error: any) => {
        console.log(error.response.data);
      }
    );

  // Builds http header.
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  return headers;
}
