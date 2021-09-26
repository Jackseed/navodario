/* eslint-disable */
import functions = require('firebase-functions');
const axios = require('axios').default;

//--------------------------------
//    Requests Spotify token    //
//--------------------------------
// Gets either an access or refresh Spotify token.
export async function getSpotifyToken(data: any, context: any) {
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

  console.log('new version');
  // If there is a refresh token, it's a first connexion
  if (refresh_token) {
    console.log('here');
    await axios
      .get('https://api.spotify.com/v1/me', config)
      .then((response: any) => console.log(response))
      .catch((error: any) => console.log(error.response.data));
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
      userId: data.userId,
    },
    method: 'POST',
  }).catch((err: any) => console.log('error: ', err));

  return { token, refresh_token };
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
        console.log('error: ', error);
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
