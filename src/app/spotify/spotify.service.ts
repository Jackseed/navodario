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
import { Devices, Tokens, Track, WebPlaybackState } from './spotify.model';
import { User } from '../auth/auth.model';

@Injectable({
  providedIn: 'root',
})
export class SpotifyService {
  constructor(
    private afs: AngularFirestore,
    private authService: AuthService,
    private fns: AngularFireFunctions,
    private http: HttpClient,
    private title: Title
  ) {}

  //--------------------------------
  //            PLAYER            //
  //--------------------------------
  public async initializePlayer(user: User, trackUris?: string[]) {
    // @ts-ignore: Unreachable code error
    const { Player } = await this.waitForSpotifyWebPlaybackSDKToLoad();
    const player = new Player({
      name: 'Nova Jukebox',
      getOAuthToken: async (callback: any) => {
        const token = (await this.getToken()).token;

        callback(token);
      },
    });

    player.connect();

    // Sets device id
    player.addListener('ready', async ({ device_id }) => {
      this.saveDeviceId(user.uid, device_id);

      console.log('Device ready', device_id);

      if (trackUris) this.playSpotify(trackUris, device_id);
    });

    // Sets page title on track change.
    player.on('player_state_changed', async (state: WebPlaybackState) => {
      if (!state) return;

      state.paused
        ? this.title.setTitle('Nova Jukebox')
        : this.title.setTitle(
            `${state.track_window.current_track.name} - ${state.track_window.current_track.artists[0].name}`
          );
    });
  }

  // Checks if window.Spotify object has either already been defined,
  // or checks until window.onSpotifyWebPlaybackSDKReady has been fired.
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

  //--------------------------------
  //             PLAY             //
  //--------------------------------
  public async playSpotify(
    trackUris: string[],
    newDeviceId?: string
  ): Promise<void> {
    let deviceId = newDeviceId ? newDeviceId : '';

    // Verifies user device if no new device id is attached.
    if (!newDeviceId) {
      let user = await this.authService.getUser();
      deviceId = user.deviceId;

      // Verifies that deviceId is still valid, otherwise updates it and relaunches play.
      const deviceExists = await this.isDeviceExisting(user);
      if (!deviceExists) {
        await this.initializePlayer(user, trackUris);
        return;
      }
    }
    // Prepares and sends play request.
    trackUris = this.limitTrackAmount(trackUris);
    const baseUrl = 'https://api.spotify.com/v1/me/player/play';
    const body = { uris: trackUris };
    const queryParam = `?device_id=${deviceId}`;

    this.putRequests(baseUrl, queryParam, body);
  }

  public async pause() {
    const baseUrl = 'https://api.spotify.com/v1/me/player/pause';

    return this.putRequests(baseUrl, '', null);
  }

  //--------------------------------
  //            DEVICE            //
  //--------------------------------
  private saveDeviceId(userId: string, deviceId: string): Promise<void> {
    return this.afs.collection('users').doc(userId).update({ deviceId });
  }

  private async isDeviceExisting(user: User): Promise<boolean> {
    const devices = await this.userAvailableDevices();

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

  //--------------------------------
  //             TOKEN            //
  //--------------------------------
  // Get & save access token if code as param, otherwise refresh.
  public async getToken(code?: string): Promise<Tokens> {
    const user = await this.authService.getUser();
    const getTokenFunction = this.fns.httpsCallable('getSpotifyToken');
    let param: Object;

    code
      ? (param = { code: code, tokenType: 'access' })
      : (param = {
          tokenType: 'refresh',
          refreshToken: user.tokens.refresh,
          userId: user.uid,
        });

    return getTokenFunction(param).pipe(first()).toPromise();
  }

  private async getHeaders(): Promise<HttpHeaders> {
    const user = await this.authService.getUser();
    let token = user.tokens.access;
    const isTokenValid = await this.isTokenStillValid();

    if (!isTokenValid) token = (await this.getToken()).token;

    const headers = new HttpHeaders().set('Authorization', 'Bearer ' + token);

    return headers;
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
  //--------------------------------
  //            TRACKS            //
  //--------------------------------
  get filteredTracks$(): Promise<Track[]> {
    const today = new Date();
    return this.afs
      .collection('tracks', (ref) =>
        ref
          .where('added_at_day', '==', today.getDay())
          .where('added_at_hours', '==', today.getHours())
      )
      .valueChanges()
      .pipe(first())
      .toPromise() as Promise<Track[]>;
  }

  private limitTrackAmount(trackUris?: string[]): string[] {
    // Not documented by Spotify but it looks like there is a limit around 700 tracks.
    const urisLimit = 700;
    if (trackUris?.length > urisLimit)
      trackUris = trackUris.slice(0, urisLimit - 1);
    return trackUris;
  }

  //--------------------------------
  //             UTILS            //
  //--------------------------------
  private async putRequests(baseUrl: string, queryParam: string, body: Object) {
    const headers = await this.getHeaders();

    return this.http
      .put(`${baseUrl + queryParam}`, body, { headers })
      .pipe(first())
      .toPromise();
  }
}
