// Angular
import { Component, HostListener, OnInit } from '@angular/core';
import { DialogComponent } from '../dialog/dialog.component';
// Angularfire
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
// Rxjs
import { Subscription } from 'rxjs';
import { filter, first, map, switchMap, tap } from 'rxjs/operators';
// Flex layout
import { MediaObserver, MediaChange } from '@angular/flex-layout';
// Material
import { MatDialog } from '@angular/material/dialog';
import { environment } from 'src/environments/environment';
import { NavigationEnd, Router } from '@angular/router';
import { User } from '../auth/auth.model';

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss'],
})
export class HomepageComponent implements OnInit {
  private watcher: Subscription;
  public dialogWidth: string;
  public dialogHeight: string;
  isPlaying = false;
  startTime = 0;
  authorizeURL = 'https://accounts.spotify.com/authorize';
  clientId: string = environment.spotify.clientId;
  responseType: string = environment.spotify.responseType;
  redirectURI = environment.spotify.redirectURI;
  scope = ['streaming', 'user-read-email', 'user-read-private'].join('%20');

  constructor(
    private router: Router,
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private fns: AngularFireFunctions,
    public dialog: MatDialog,
    private mediaObserver: MediaObserver
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
        filter((event) => event instanceof NavigationEnd),
        tap((event) => {
          if (event.url) {
            const code = event.url.substring(event.url.indexOf('=') + 1);
            this.getAccessToken(code);
            // otherwise get a refresh token
          } else {
            this.getRefreshToken();
          }
        }),
        first()
      )
      .subscribe();
  }

  async play() {
    const delta = Date.now() - this.startTime;
    if (delta < 3200) return;
    // if not playing, play; otherwise pause
    if (!this.isPlaying) {
      this.changeBackground('url(../../assets/play.gif)');
      this.isPlaying = true;
      setTimeout(
        () => this.changeBackground('url(../../assets/playing.gif)'),
        2700
      );
    } else {
      this.changeBackground('url(../../assets/pause.gif)');
      this.isPlaying = false;
      setTimeout(
        () => this.changeBackground('url(../../assets/start.gif)'),
        3000
      );
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
        console.log('log in successfully');
        this.afAuth.authState
          .pipe(
            tap(async (user) => {
              console.log('here ');
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

  private async getAccessToken(code: string) {
    const getTokenFunction = this.fns.httpsCallable('getSpotifyToken');
    this.afAuth.user
      .pipe(
        tap((user) => {
          console.log('over here', code);
          getTokenFunction({
            code: code,
            tokenType: 'access',
            userId: user.uid,
          })
            .pipe(first())
            .subscribe();
        }),
        first()
      )
      .subscribe();
  }

  private async getRefreshToken() {
    console.log('getting refresh token');
    const getTokenFunction = this.fns.httpsCallable('getSpotifyToken');
    this.afAuth.user
      .pipe(
        switchMap((authUser) => {
          const userDoc = this.afs.doc<User>(`users/${authUser.uid}`);
          return userDoc.valueChanges();
        }),
        map((dbUser) => dbUser.tokens.refresh),
        map((refreshToken) => {
          console.log('refreshing token ', refreshToken);
          return getTokenFunction({
            refreshToken,
            tokenType: 'refresh',
          })
            .pipe(first())
            .subscribe();
        }),
        first()
      )
      .subscribe();
  }
}
