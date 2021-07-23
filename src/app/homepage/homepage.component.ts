// Angular
import { Component, HostListener, OnInit } from '@angular/core';
import { DialogComponent } from '../dialog/dialog.component';
// Angularfire
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
// Rxjs
import { Subscription } from 'rxjs';
import { filter, first, map, tap } from 'rxjs/operators';
// Flex layout
import { MediaObserver, MediaChange } from '@angular/flex-layout';
// Material
import { MatDialog } from '@angular/material/dialog';

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

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
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
          this.dialogWidth = '25vw';
          this.dialogHeight = '30vh';
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
  }

  async anonymousLogin() {
    await this.afAuth.signInAnonymously();
    const user = await this.afAuth.authState.pipe(first()).toPromise();
    if (user) {
      this.setUser(user.uid);
    }
  }

  private setUser(id: string) {
    this.afs.collection('users').doc(id).set({ id });
  }
}
