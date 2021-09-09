// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  spotify: {
    apiUrl: 'https://api.spotify.com/v1/me',
    clientId: 'ef247ad2b6a6480ab274d9f32b27dfe9',
    responseType: 'code',
    redirectURI: 'http://localhost:4200',
  },
  firebaseConfig: {
    apiKey: 'AIzaSyA4tisWY2LHSngQ8kgH9niQYxuUYmOb5Bs',
    authDomain: 'nova-jukebox-dev.firebaseapp.com',
    projectId: 'nova-jukebox-dev',
    storageBucket: 'nova-jukebox-dev.appspot.com',
    messagingSenderId: '134869899173',
    appId: '1:134869899173:web:4b506fc25a48a9f62a3a4c',
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
