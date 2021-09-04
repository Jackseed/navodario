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
import { Track } from '../spotify/track.model';
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

  constructor(
    private router: Router,
    private afAuth: AngularFireAuth,
    public dialog: MatDialog,
    private mediaObserver: MediaObserver,
    private spotifyService: SpotifyService,
    private authService: AuthService
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

            this.spotifyService.getAccessTokenAndInitializePlayer(code);

            // otherwise get a refresh token
          } else {
            this.spotifyService
              .getRefreshToken()
              .then(
                (
                  _ // instantiate the player
                ) =>
                  this.spotifyService
                    .initializePlayer()
                    .catch((err) => console.log(err))
              )
              .catch((err) => console.log(err));
          }
        }),
        first()
      )
      .subscribe();
  }

  async play() {
    // add delay for animations to complete
    const delta = Date.now() - this.startTime;
    if (delta < 3200) return;

    this.isPlaying ? this.pause : this.playTracks();

    this.startTime = Date.now();
  }

  private playTracks() {
    // animation & audio
    this.playAudio('../../assets/vinyle_start.wav');
    this.changeBackground('url(../../assets/play.gif)');

    this.isPlaying = true;

    setTimeout(() => {
      // set playing animation when play animation is over
      this.changeBackground('url(../../assets/playing.gif)');
      // get according tracks & play
      this.spotifyService.filteredTracks$
        .pipe(
          tap((tracks: Track[]) => {
            let uris = tracks.map((track) => track.uri);
            // randomize tracks
            uris = this.shuffleArray(uris);
            this.spotifyService.playSpotify(uris);
          }),
          first()
        )
        .subscribe();
    }, 2700);
  }

  private pause() {
    // animation & audio
    this.playAudio('../../assets/vinyle_end.wav');
    this.changeBackground('url(../../assets/pause.gif)');
    this.isPlaying = false;

    setTimeout(() => {
      // set start animation when pause animation is over
      this.changeBackground('url(../../assets/start.gif)');
      this.spotifyService.pause();
    }, 3000);
  }

  changeBackground(img: string) {
    document.getElementById('image').style.backgroundImage = img;
  }

  // spacebar as pause button
  @HostListener('document:keydown', ['$event']) onKeydownHandler(
    event: KeyboardEvent
  ) {
    if (event.key === ' ') {
      this.play();
    }
  }

  // login dialog
  openDialog(): void {
    const dialogRef = this.dialog.open(DialogComponent, {
      width: this.dialogWidth,
      maxWidth: this.dialogWidth,
      height: this.dialogHeight,
      maxHeight: this.dialogHeight,
    });
    dialogRef.afterClosed().subscribe(async (result) => {
      await this.authService.anonymousLogin();
    });
  }

  // source: https://en.wikipedia.org/wiki/Fisher-Yates_shuffle#The_modern_algorithm
  private shuffleArray(array: string[]): string[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

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
