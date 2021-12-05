import puppeteer = require('puppeteer');
import functions = require('firebase-functions');
import { nova, limitTracksToCheck } from './data/types';
import { saveTracksToPlaylist, getPlaylistLastTrackIds } from './spotify-utils';
import { getSpotifyAuthHeaders } from './spotify-auth';

const axios = require('axios').default;

//--------------------------------
//      Save all playlists      //
//--------------------------------
// Scraps and saves every nova channels to corresponding Spotify playlists.
export async function scrapeAndSaveAllNovaChannels() {
  // Creates a request per Noval channel.
  const requestsArray = nova.map((channel) => {
    const request = axios({
      headers: {
        'Content-Type': 'application/json',
      },
      url: functions.config().functions.savenovaonspotify,
      data: {
        playlistId: channel.playlistId,
        frequence: channel.frequence,
      },
      method: 'POST',
    });

    return request;
  });
  // Send all the requests at once.
  await Promise.all(
    requestsArray.map(async (request) => {
      return await request
        .then((response: any) => {
          console.log('promises well sent');
        })
        .catch((err: any) =>
          console.log('Something broke!', err.response.data)
        );
    })
  )
    .then(() => {
      console.log('All good!');
    })
    .catch((err) => console.log('something went wrong.. ', err.response.data));
}

//--------------------------------
//      Save one playlist       //
//--------------------------------
// Scraps a nova channel and checks if tracks were saved already.
// Then saves it to the corresponding Spotify playlist.
export async function saveNovaOnSpotify(req: any, res: any): Promise<any> {
  const trackIds = await scrapeNovaTrackIds(req.body.frequence);

  const headers = await getSpotifyAuthHeaders();

  const playlistLastTrackIds = await getPlaylistLastTrackIds(
    headers,
    req.body.playlistId,
    limitTracksToCheck
  );

  // Filters nova trackIds with duplicates.
  const filteredIds = trackIds.filter(
    (id: string) => !playlistLastTrackIds.includes(id)
  );

  // Formats uris.
  const uris = filteredIds.map((id: string) => `spotify:track:${id}`).reverse();

  const response = await saveTracksToPlaylist(
    headers,
    req.body.playlistId,
    uris
  );

  res.end(response);
}

//--------------------------------
//          Scrape nova         //
//--------------------------------
// Scrapes nova played tracks into Spotify track ids.
async function scrapeNovaTrackIds(radioValue: string): Promise<string[]> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  // Mocks CET time.
  await page.emulateTimezone('Europe/Brussels');

  // Goes to Nova.
  await page.goto('https://www.nova.fr/c-etait-quoi-ce-titre/');

  // Accepts cookies.
  if ((await page.$('[id="didomi-notice-agree-button"]')) !== null)
    await page.click('[id="didomi-notice-agree-button"]');
  // Selects a Nova channel.
  await page.select('#radio', radioValue);

  // Saves the form.
  await page.evaluate(() => {
    const element: HTMLElement | null = document.querySelector(
      '#js-mobile-program-filter > a'
    );
    element?.click();
  });

  // Waits for the page to load.
  await page.waitForTimeout(2000);

  // Gets Spotify uris.
  const data = await page.evaluate(async () => {
    const links = document.querySelectorAll('a');
    const urls = Array.from(links)
      .map((link) => link.href)
      .filter((href) => href.includes('spotify'));

    return urls;
  });

  await browser.close();

  // Extracts trackIds from uris.
  const trackIds: string[] = [];
  data.map((trackUrl: string) => {
    const trackId = trackUrl.substring(trackUrl.indexOf('k') + 2);
    trackIds.push(trackId);
  });

  return trackIds;
}
