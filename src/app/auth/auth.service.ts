// Angular
import { Injectable } from '@angular/core';
// Angularfire
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
// Rxjs
import { first } from 'rxjs/operators';
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
  private scope = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
  ].join('%20');

  constructor(private afAuth: AngularFireAuth, private afs: AngularFirestore) {}

  public async getUser(): Promise<User | null> {
    const authUser = await this.afAuth.authState.pipe(first()).toPromise();
    if (!!!authUser) return null;
    const userDoc = this.afs.doc<User>(`users/${authUser.uid}`);
    const user = await userDoc.valueChanges().pipe(first()).toPromise();
    return user;
  }

  public authSpotify() {
    this.authorizeURL += '?' + 'client_id=' + this.clientId;
    this.authorizeURL += '&response_type=' + this.responseType;
    this.authorizeURL += '&redirect_uri=' + this.redirectURI;
    this.authorizeURL += '&scope=' + this.scope;

    window.location.href = this.authorizeURL;
  }
}
