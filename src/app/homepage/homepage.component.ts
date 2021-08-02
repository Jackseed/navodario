// Angular
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DialogComponent } from '../dialog/dialog.component';
// Angularfire
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import firebase from 'firebase/app';
// Rxjs
import { Observable, of, Subscription } from 'rxjs';
import { catchError, filter, first, map, switchMap, tap } from 'rxjs/operators';
// Flex layout
import { MediaObserver, MediaChange } from '@angular/flex-layout';
// Material
import { MatDialog } from '@angular/material/dialog';
import { environment } from 'src/environments/environment';
import { NavigationEnd, Router, RouterEvent } from '@angular/router';
import { User } from '../auth/auth.model';
import { Track } from '../track.model';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady(): void;
    // @ts-ignore: Unreachable code error
    Spotify: typeof Spotify;
  }
}

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss'],
})
export class HomepageComponent implements OnInit, OnDestroy {
  private watcher: Subscription;
  private dialogWidth: string;
  private dialogHeight: string;
  private isPlaying = false;
  private startTime = 0;
  private authorizeURL = 'https://accounts.spotify.com/authorize';
  private clientId: string = environment.spotify.clientId;
  private responseType: string = environment.spotify.responseType;
  private redirectURI = environment.spotify.redirectURI;
  private scope = ['streaming', 'user-read-email', 'user-read-private'].join(
    '%20'
  );
  private filteredTracks$;

  constructor(
    private router: Router,
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private fns: AngularFireFunctions,
    public dialog: MatDialog,
    private mediaObserver: MediaObserver,
    private http: HttpClient
  ) {
    this.watcher = this.mediaObserver
      .asObservable()
      .pipe(
        filter((changes: MediaChange[]) => changes.length > 0),
        map((changes: MediaChange[]) => changes[0])
      )
      .subscribe((change: MediaChange) => {
        if (change.mqAlias === 'xs') {
          this.dialogWidth = '80vw';
          this.dialogHeight = '60vh';
        } else {
          this.dialogWidth = '500px';
          this.dialogHeight = '300px';
        }
      });
  }

  ngOnInit(): void {
    // if no user, open dialog to create one
    this.afAuth.user
      .pipe(
        filter((user) => !!!user),
        tap((_) => this.openDialog()),
        first()
      )
      .subscribe();

    // if url includes a code, get an access token
    this.router.events
      .pipe(
        // wait for redirection to be ended before checking the url
        filter((event) => event instanceof NavigationEnd),
        tap((event: RouterEvent) => {
          // if there is code in the url it's a first connexion,
          // then get an access token
          if (event.url.includes('code')) {
            const code = event.url.substring(event.url.indexOf('=') + 1);
            this.getAccessTokenAndInitializePlayer(code);

            // otherwise get a refresh token
          } else {
            this.getRefreshToken()
              .then(
                (
                  _ // instantiate the player
                ) => this.initializePlayer().catch((err) => console.log(err))
              )
              .catch((err) => console.log(err));
          }
        }),
        first()
      )
      .subscribe();

    this.filteredTracks$ = this.filteredTrack$;
    this.filteredTracks$.subscribe(console.log);
  }

  async play() {
    const delta = Date.now() - this.startTime;
    if (delta < 3200) return;
    // if not playing, play; otherwise pause
    if (!this.isPlaying) {
      this.changeBackground('url(../../assets/play.gif)');
      this.isPlaying = true;
      setTimeout(() => {
        this.changeBackground('url(../../assets/playing.gif)');
        this.filteredTrack$
          .pipe(
            tap((tracks: Track[]) => {
              const uris = tracks.map((track) => track.uri);
              this.playSpotify(uris);
            }),
            first()
          )
          .subscribe();
      }, 2700);
    } else {
      this.changeBackground('url(../../assets/pause.gif)');
      this.isPlaying = false;
      setTimeout(() => {
        this.changeBackground('url(../../assets/start.gif)');
        this.pause();
      }, 3000);
    }
    this.startTime = Date.now();
  }

  changeBackground(img: string) {
    document.getElementById('image').style.backgroundImage = img;
  }

  @HostListener('document:keydown', ['$event']) onKeydownHandler(
    event: KeyboardEvent
  ) {
    if (event.key === ' ') {
      this.play();
    }
  }

  get filteredTrack$() {
    const today = new Date();
    return this.afs
      .collection('tracks', (ref) =>
        ref
          .where('added_at_day', '==', today.getDay())
          .where('added_at_hours', '==', today.getHours())
      )
      .valueChanges();
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(DialogComponent, {
      width: this.dialogWidth,
      maxWidth: this.dialogWidth,
      height: this.dialogHeight,
      maxHeight: this.dialogHeight,
    });
    dialogRef.afterClosed().subscribe(async (result) => {
      await this.anonymousLogin();
    });
  }

  private authSpotify() {
    this.authorizeURL += '?' + 'client_id=' + this.clientId;
    this.authorizeURL += '&response_type=' + this.responseType;
    this.authorizeURL += '&redirect_uri=' + this.redirectURI;
    this.authorizeURL += '&scope=' + this.scope;

    window.location.href = this.authorizeURL;
  }

  async anonymousLogin() {
    await this.afAuth
      .signInAnonymously()
      .then(async (_) => {
        this.afAuth.authState
          .pipe(
            tap(async (user) => {
              await this.setUser(user.uid).then((_) => this.authSpotify());
            }),
            first()
          )
          .subscribe();
      })
      .catch((err) => console.log('login error ', err));
  }

  private setUser(id: string): Promise<void> {
    return this.afs.collection('users').doc(id).set({ id });
  }

  private async getAccessTokenAndInitializePlayer(code: string) {
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

  private async getRefreshToken() {
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

  private get user$(): Observable<User> {
    return this.afAuth.user.pipe(
      switchMap((authUser) => {
        const userDoc = this.afs.doc<User>(`users/${authUser.uid}`);
        return userDoc.valueChanges();
      })
    );
  }

  private async initializePlayer(): Promise<Subscription> {
    // @ts-ignore: Unreachable code error
    const { Player } = await this.waitForSpotifyWebPlaybackSDKToLoad();
    const user$ = this.user$;

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

  private async playSpotify(trackUris?: string[]): Promise<void> {
    trackUris = this.limitTrackAmount(trackUris);
    const user$ = this.user$;
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
    const user$ = this.user$;
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

  ngOnDestroy(): void {
    this.watcher.unsubscribe();
  }
}
