// Angular
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterEvent } from '@angular/router';
// Angularfire
import { AngularFireAuth } from '@angular/fire/auth';
// Rxjs
import { Subscription } from 'rxjs';
import { filter, first, map, tap } from 'rxjs/operators';
// Flex layout
import { MediaObserver, MediaChange } from '@angular/flex-layout';
// Material
import { MatDialog } from '@angular/material/dialog';
// Services
import { SpotifyService } from '../spotify/spotify.service';
import { AuthService } from '../auth/auth.service';
// Models
import { Tokens } from '../spotify/spotify.model';
// Components
import { DialogComponent } from '../dialog/dialog.component';

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
  private gifs = [
    '/assets/play.gif',
    '/assets/pause.gif',
    '/assets/playing.gif',
  ];

  constructor(
    private router: Router,
    private afAuth: AngularFireAuth,
    public dialog: MatDialog,
    private mediaObserver: MediaObserver,
    private spotifyService: SpotifyService,
    private authService: AuthService
  ) {
    // Media query for a responsive login dialog.
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

  ngOnInit() {
    this.loadGifs();
    // If user isn't connected, opens dialog to create one.
    this.afAuth.user
      .pipe(
        filter((user) => !!!user),
        tap((_) => this.openLoginDialog()),
        first()
      )
      .subscribe();

    // Checks for a code within url to know if it's a first connexion.
    this.router.events
      .pipe(
        // Waits for redirection to be ended before checking url for a Spotify access code.
        filter((event) => event instanceof NavigationEnd),
        tap(async (event: RouterEvent) => {
          const user = await this.authService.getUser();
          if (user)
            event.url.includes('code')
              ? await this.getAccessTokenWithCode(
                  event.url.substring(event.url.indexOf('=') + 1)
                )
              : // If there is no code within url and a user exists, refreshes Spotify access token.
              user.tokens
              ? await this.refreshToken()
              : this.openLoginDialog();
        }),
        first()
      )
      .subscribe();
  }

  // Pre-loads gifs to avoid glitches.
  private loadGifs() {
    for (let i = 0; i < this.gifs.length; i++) {
      let gif = new Image();
      gif.src = this.gifs[i];
    }
  }

  // Gets a Spotify access token with a code.
  private async getAccessTokenWithCode(code: string): Promise<Tokens> {
    return this.spotifyService.getToken(code);
  }

  // Gets a Spotify refresh token based on an already registered access token.
  private async refreshToken(): Promise<Tokens> {
    return this.spotifyService.getToken();
  }

  // Plays or pauses Spotify player depending on the context.
  public async play() {
    // add delay for animations to complete
    const delta = Date.now() - this.startTime;
    if (delta < 3200) return;

    this.isPlaying ? this.pause() : this.playTracks();

    this.startTime = Date.now();
  }

  // Activates an animation and plays tracks from same day and hour.
  private playTracks() {
    this.playAudio('../../assets/vinyle_start.wav');
    this.changeBackground('url(../../assets/play.gif)');

    this.isPlaying = true;

    setTimeout(async () => {
      this.changeBackground('url(../../assets/playing.gif)');

      const tracks = await this.spotifyService.filteredTracks$;
      let uris = tracks.map((track) => track.uri);
      uris = this.shuffleArray(uris);
      this.spotifyService.playSpotify(uris);
    }, 2700);
  }

  // Pauses Spotify player.
  private pause() {
    this.playAudio('../../assets/vinyle_end.wav');
    this.changeBackground('url(../../assets/pause.gif)');
    this.isPlaying = false;

    setTimeout(() => {
      this.changeBackground('url(../../assets/start.gif)');
      this.spotifyService.pause();
    }, 3000);
  }

  // Changes the app background image.
  private changeBackground(img: string) {
    document.getElementById('image').style.backgroundImage = img;
  }

  // Implements spacebar as play / pause button.
  @HostListener('document:keydown', ['$event']) onKeydownHandler(
    event: KeyboardEvent
  ) {
    if (event.key === ' ') {
      this.play();
    }
  }

  // Opens a dialog that will redirect to Spotify auth and will login to Firebase.
  private openLoginDialog(): void {
    const dialogRef = this.dialog.open(DialogComponent, {
      width: this.dialogWidth,
      maxWidth: this.dialogWidth,
      height: this.dialogHeight,
      maxHeight: this.dialogHeight,
    });
    dialogRef.afterClosed().subscribe(async () => {
      await this.authService.anonymousLogin();
    });
  }

  // Shuffles tracks using Fisher Yates modern algorithm.
  private shuffleArray(array: string[]): string[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Plays a turntable sound.
  private playAudio(src: string) {
    const audio = new Audio();
    audio.src = src;
    audio.load();
    audio.play();
  }

  ngOnDestroy(): void {
    this.watcher.unsubscribe();
  }
}
