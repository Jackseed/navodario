// Angular
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
// Angularfire
import firebase from 'firebase/app';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
// Rxjs
import { first } from 'rxjs/operators';
// Services
import { AuthService } from '../auth/auth.service';
// Models
import { Devices, Tokens, WebPlaybackState } from './spotify.model';

@Injectable({
  providedIn: 'root',
})
export class SpotifyService {
  private deviceId: string;

  constructor(
    private afs: AngularFirestore,
    private authService: AuthService,
    private fns: AngularFireFunctions,
    private http: HttpClient,
    private title: Title
  ) {}

  public async initializePlayer() {
    // @ts-ignore: Unreachable code error
    const { Player } = await this.waitForSpotifyWebPlaybackSDKToLoad();
    const user = await this.authService.getUser();

    const player = new Player({
      name: 'Nova Jukebox',
      getOAuthToken: async (callback: any) => {
        let token = user.tokens.access;

        if (!this.isTokenStillValid()) token = (await this.getToken()).token;

        callback(token);
      },
    });

    await player.connect();

    // Set device id
    player.addListener('ready', ({ device_id }) => {
      this.deviceId = device_id;
      this.saveDeviceId(user.id, device_id);
    });

    // Set page title on track change
    player.on('player_state_changed', async (state: WebPlaybackState) => {
      if (!state) return;

      state.paused
        ? this.title.setTitle('Nova Jukebox')
        : this.title.setTitle(
            `${state.track_window.current_track.artists[0].name} - ${state.track_window.current_track.name}`
          );
    });
  }

  // check if window.Spotify object has either already been defined, or check until window.onSpotifyWebPlaybackSDKReady has been fired
  public async waitForSpotifyWebPlaybackSDKToLoad() {
    return new Promise((resolve) => {
      if (window.Spotify) {
        resolve(window.Spotify);
      } else {
        window.onSpotifyWebPlaybackSDKReady = () => {
          resolve(window.Spotify);
        };
      }
    });
  }

  private saveDeviceId(userId: string, deviceId: string): Promise<void> {
    return this.afs.collection('users').doc(userId).update({ deviceId });
  }

  public async playSpotify(trackUris?: string[]): Promise<void> {
    let user = await this.authService.getUser();
    let deviceId = user.deviceId;

    // verify that deviceId is still valid, otherwise update it
    const deviceExists = await this.isDeviceExisting();
    if (!deviceExists) {
      await this.initializePlayer();
      deviceId = this.deviceId;
    }

    // prepare and send play request
    if (trackUris) trackUris = this.limitTrackAmount(trackUris);
    const baseUrl = 'https://api.spotify.com/v1/me/player/play';
    const body = trackUris ? { uris: trackUris } : null;
    const queryParam = deviceId && trackUris ? `?device_id=${deviceId}` : '';
    console.log('playing with deviceId: ', deviceId);
    
    this.putRequests(baseUrl, queryParam, body);
  }

  private async isDeviceExisting(): Promise<boolean> {
    const devices = await this.userAvailableDevices();
    const user = await this.authService.getUser();

    let deviceExists = false;
    devices.devices.forEach((device) => {
      if (user.deviceId === device.id) deviceExists = true;
    });

    return deviceExists;
  }

  private async userAvailableDevices(): Promise<Devices> {
    const headers = await this.getHeaders();
    const url = 'https://api.spotify.com/v1/me/player/devices';
    return this.http
      .get(url, { headers })
      .pipe(first())
      .toPromise() as Promise<Devices>;
  }

  public async pause() {
    const baseUrl = 'https://api.spotify.com/v1/me/player/pause';

    return this.putRequests(baseUrl, '', null);
  }

  // get & save access token if code as param, otherwise refresh
  public async getToken(code?: string): Promise<Tokens> {
    const user = await this.authService.getUser();
    const getTokenFunction = this.fns.httpsCallable('getSpotifyToken');
    let param: Object;

    code
      ? (param = { code: code, tokenType: 'access', userId: user.id })
      : (param = {
          tokenType: 'refresh',
          refreshToken: user.tokens.refresh,
          userId: user.id,
        });

    return getTokenFunction(param).pipe(first()).toPromise();
  }

  get filteredTracks$() {
    const today = new Date();
    return this.afs
      .collection('tracks', (ref) =>
        ref
          .where('added_at_day', '==', today.getDay())
          .where('added_at_hours', '==', today.getHours())
      )
      .valueChanges();
  }

  private limitTrackAmount(trackUris?: string[]): string[] {
    // Not documented by spotify but it looks like there is a limit around 700 tracks
    const urisLimit = 700;
    if (trackUris?.length > urisLimit)
      trackUris = trackUris.slice(0, urisLimit - 1);
    return trackUris;
  }

  private async isTokenStillValid(): Promise<boolean> {
    const user = await this.authService.getUser();
    let isTokenStillValid: boolean;

    const tokenCreationTime =
      (firebase.firestore.Timestamp.now().toMillis() -
        user.tokens.addedTime.toMillis()) /
      1000;

    tokenCreationTime > 3600
      ? (isTokenStillValid = false)
      : (isTokenStillValid = true);

    return isTokenStillValid;
  }

  private async getHeaders(): Promise<HttpHeaders> {
    const user = await this.authService.getUser();
    let token = user.tokens.access;

    if (!this.isTokenStillValid()) token = (await this.getToken()).token;

    const headers = new HttpHeaders().set('Authorization', 'Bearer ' + token);

    return headers;
  }

  private async putRequests(baseUrl: string, queryParam: string, body: Object) {
    const headers = await this.getHeaders();

    return this.http
      .put(`${baseUrl + queryParam}`, body, { headers })
      .pipe(first())
      .toPromise();
  }
}
