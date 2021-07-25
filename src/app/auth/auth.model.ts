import firebase from 'firebase/app';
import Timestamp = firebase.firestore.Timestamp;

export interface User {
  id: string;
  tokens?: {
    access?: string;
    addedTime?: Timestamp;
    refresh?: string;
  };
  deviceId?: string;
}
