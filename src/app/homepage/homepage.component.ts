import { Component, HostListener, OnInit } from '@angular/core';

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss'],
})
export class HomepageComponent implements OnInit {
  isPlaying = false;
  startTime = 0;

  constructor() {}

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

}
