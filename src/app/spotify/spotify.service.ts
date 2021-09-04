// Angular
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
// Angularfire
import firebase from 'firebase/app';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
// Rxjs
import { Observable, of, Subscription } from 'rxjs';
import { catchError, first, map, switchMap, tap } from 'rxjs/operators';
// Services
import { AuthService } from '../auth/auth.service';
// Models
import { WebPlaybackState } from './track.model';
import { User } from '../auth/auth.model';

@Injectable({
  providedIn: 'root',
})
export class SpotifyService {
  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private authService: AuthService,
    private fns: AngularFireFunctions,
    private http: HttpClient,
    private title: Title
  ) {}

  public async initializePlayer(): Promise<Subscription> {
    // @ts-ignore: Unreachable code error
    const { Player } = await this.waitForSpotifyWebPlaybackSDKToLoad();
    const user$ = this.authService.user$;

    // instantiate the player
    return user$
      .pipe(
        tap(async (user: User) => {
          const token = user.tokens.access;
          const player = new Player({
            name: 'Nova Jukebox',
            getOAuthToken: (callback) => {
              callback(token);
            },
          });
          await player.connect();

          // Ready
          player.addListener('ready', async ({ device_id }) => {
            this.saveDeviceId(user.id, device_id).catch((err) =>
              console.log(err)
            );
          });

          // when player state change, set page title with track details
          player.on('player_state_changed', async (state: WebPlaybackState) => {
            if (!state) return;

            state.paused
              ? this.title.setTitle('Nova Jukebox')
              : this.title.setTitle(
                  `${state.track_window.current_track.artists[0].name} - ${state.track_window.current_track.name}`
                );
          });
        }),
        first()
      )
      .subscribe();
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
    trackUris = this.limitTrackAmount(trackUris);
    const user$ = this.authService.user$;
    const baseUrl = 'https://api.spotify.com/v1/me/player/play';

    user$
      .pipe(
        switchMap((user) => {
          const queryParam =
            user.deviceId && trackUris ? `?device_id=${user.deviceId}` : '';
          const body = trackUris ? { uris: trackUris } : null;
          return this.putRequests(baseUrl, queryParam, body);
        }),

        catchError((err) => of(console.log(err))),

        first()
      )
      .subscribe();
  }

  public async pause() {
    const baseUrl = 'https://api.spotify.com/v1/me/player/pause';

    return this.putRequests(baseUrl, '', null).pipe(first()).subscribe();
  }

  private limitTrackAmount(trackUris?: string[]): string[] {
    // Not documented by spotify but it looks like there is a limit around 700 tracks
    const urisLimit = 700;
    if (trackUris?.length > urisLimit)
      trackUris = trackUris.slice(0, urisLimit - 1);
    return trackUris;
  }

  private putRequests(baseUrl: string, queryParam: string, body: Object) {
    return this.headers$.pipe(
      switchMap((headers) =>
        this.http.put(`${baseUrl + queryParam}`, body, {
          headers,
        })
      )
    );
  }

  private get headers$(): Observable<HttpHeaders> {
    const user$ = this.authService.user$;
    return user$.pipe(
      tap(async (user) => {
        if (
          (firebase.firestore.Timestamp.now().toMillis() -
            user.tokens.addedTime.toMillis()) /
            1000 >
          3600
        ) {
          console.log('refreshing token');
          await this.getRefreshToken();
        }
      }),
      map((user) =>
        new HttpHeaders().set('Authorization', 'Bearer ' + user.tokens.access)
      )
    );
  }

  public async getAccessTokenAndInitializePlayer(code: string) {
    // get token & save it on db
    const getTokenFunction = this.fns.httpsCallable('getSpotifyToken');
    this.afAuth.user
      .pipe(
        tap((user) => {
          getTokenFunction({
            code: code,
            tokenType: 'access',
            userId: user.uid,
          })
            .pipe(first())
            .subscribe((_) =>
              this.initializePlayer().catch((err) => console.log(err))
            );
        }),
        first()
      )
      .subscribe();
  }

  public async getRefreshToken() {
    const getTokenFunction = this.fns.httpsCallable('getSpotifyToken');
    this.afAuth.user
      .pipe(
        switchMap((authUser) => {
          const userDoc = this.afs.doc<User>(`users/${authUser.uid}`);
          return userDoc.valueChanges();
        }),
        map((dbUser) => {
          return getTokenFunction({
            userId: dbUser.id,
            refreshToken: dbUser.tokens.refresh,
            tokenType: 'refresh',
          })
            .pipe(first())
            .subscribe();
        }),
        first()
      )
      .subscribe();
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
}
