// Angular thingy
import { BrowserModule } from '@angular/platform-browser';
import { ErrorHandler, Injectable, NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { environment } from 'src/environments/environment';
// Components
import { AppComponent } from './app.component';
import { HomepageComponent } from './homepage/homepage.component';
import { DialogComponent } from './dialog/dialog.component';
// Angular fire
import { AngularFireModule } from '@angular/fire';
// Material
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { HttpClientModule } from '@angular/common/http';
// Sentry
import * as Sentry from '@sentry/browser';
import { AngularFireAuth } from '@angular/fire/auth';
import { first } from 'rxjs/operators';

Sentry.init({
  dsn: environment.sentry.dsn,
  environment: environment.production ? 'prod' : 'dev',
});
@Injectable()
export class SentryErrorHandler implements ErrorHandler {
  constructor(private afAuth: AngularFireAuth) {
    this.afAuth.user.pipe(first()).subscribe((user) => {
      if (!user) return;

      Sentry.configureScope((scope) => {
        scope.setUser({
          id: user.uid,
        });
      });
    });
  }
  handleError(error) {
    if (!environment.production) console.error(error);
    Sentry.captureException(error.originalError || error);
  }
}

@NgModule({
  declarations: [AppComponent, HomepageComponent, DialogComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    AngularFireModule.initializeApp(environment.firebaseConfig),
    BrowserAnimationsModule,
    MatDialogModule,
    MatButtonModule,
    HttpClientModule,
  ],
  providers: [
    {
      provide: ErrorHandler,
      useClass: SentryErrorHandler,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
