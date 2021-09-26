export const environment = {
  production: true,
  useEmulators: false,
  spotify: {
    apiUrl: 'https://api.spotify.com/v1/me',
    clientId: 'ef247ad2b6a6480ab274d9f32b27dfe9',
    responseType: 'code',
    redirectURI: 'https://nova-jukebox.web.app/',
  },
  firebaseConfig: {
    apiKey: 'AIzaSyBc4oEqQ_J5vJIyZys630Z3RCQpZJn2E9o',
    authDomain: 'nova-jukebox.firebaseapp.com',
    projectId: 'nova-jukebox',
    storageBucket: 'nova-jukebox.appspot.com',
    messagingSenderId: '960630257139',
    appId: '1:960630257139:web:a068fecd4d6d13c3974e86',
    measurementId: 'G-NTMEGQ3X5F',
  },
  sentry: {
    dsn: 'https://b7e0682855ae4198a301b27b6ae28fd7@o1005951.ingest.sentry.io/5966427',
  },
};
