import firebase from 'firebase/app';
import Timestamp = firebase.firestore.Timestamp;

export interface User {
  uid: string;
  displayName: string;
  email: string;
  tokens?: {
    access?: string;
    addedTime?: Timestamp;
    refresh?: string;
  };
  deviceId?: string;
}
