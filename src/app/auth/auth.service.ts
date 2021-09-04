// Angular
import { Injectable } from '@angular/core';
// Angularfire
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
// Rxjs
import { Observable } from 'rxjs';
import { first, switchMap, tap } from 'rxjs/operators';
// Env
import { environment } from 'src/environments/environment';
// Models
import { User } from './auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authorizeURL = 'https://accounts.spotify.com/authorize';
  private clientId: string = environment.spotify.clientId;
  private responseType: string = environment.spotify.responseType;
  private redirectURI = environment.spotify.redirectURI;
  private scope = ['streaming', 'user-read-email', 'user-read-private'].join(
    '%20'
  );
  constructor(private afAuth: AngularFireAuth, private afs: AngularFirestore) {}

  get user$(): Observable<User> {
    return this.afAuth.user.pipe(
      switchMap((authUser) => {
        const userDoc = this.afs.doc<User>(`users/${authUser.uid}`);
        return userDoc.valueChanges();
      })
    );
  }

  public async anonymousLogin() {
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
  
  private authSpotify() {
    this.authorizeURL += '?' + 'client_id=' + this.clientId;
    this.authorizeURL += '&response_type=' + this.responseType;
    this.authorizeURL += '&redirect_uri=' + this.redirectURI;
    this.authorizeURL += '&scope=' + this.scope;

    window.location.href = this.authorizeURL;
  }
}
