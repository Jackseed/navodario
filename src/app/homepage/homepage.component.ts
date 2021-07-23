import { Component, HostListener, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss'],
})
export class HomepageComponent implements OnInit {
  isPlaying = false;
  startTime = 0;

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore
  ) {}

  ngOnInit(): void {}

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
