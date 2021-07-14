import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss'],
})
export class HomepageComponent implements OnInit {
  background = '--img: url(../../assets/start.gif)';
  constructor() {}

  ngOnInit(): void {}

  play() {
    this.background = '--img: url(../../assets/play.gif)';

    setTimeout(
      () => (this.background = '--img: url(../../assets/playing.gif)'),
      3200
    );
  }

  pause() {
    this.background = '--img: url(../../assets/pause.gif)';
    setTimeout(
      () => (this.background = '--img: url(../../assets/start.gif)'),
      3200
    );
  }
}
