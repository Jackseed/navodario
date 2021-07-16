import { Component, HostListener, OnInit } from '@angular/core';

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss'],
})
export class HomepageComponent implements OnInit {
  isPlaying = false;
  background = '--img: url(../../assets/start.gif)';
  startTime = 0;

  constructor() {}

  ngOnInit(): void {}

  async play() {
    const delta = Date.now() - this.startTime;
    if (delta < 3200) return;
    // if not playing, play; otherwise pause
    if (!this.isPlaying) {
      this.background = '--img: url(../../assets/play.gif)';
      this.isPlaying = true;
    } else {
      this.background = '--img: url(../../assets/pause.gif)';
      this.isPlaying = false;
    }
    this.startTime = Date.now();
    setTimeout(
      () =>
        this.isPlaying
          ? (this.background = '--img: url(../../assets/playing.gif)')
          : (this.background = '--img: url(../../assets/start.gif)'),
      3200
    );
  }

  @HostListener('document:keydown', ['$event']) onKeydownHandler(
    event: KeyboardEvent
  ) {
    if (event.key === ' ') {
      this.play();
    }
  }
}
