import firebase from 'firebase/app';
import Timestamp = firebase.firestore.Timestamp;

export interface Track {
  added_at: Timestamp;
  id: string;
  name: string;
  uri: string;
  spotifyId: string;
  duration_ms: number;
  artist: string;
  album: string;
  image: string;
  nova_channel: string;
}
