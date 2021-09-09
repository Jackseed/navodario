import firebase from 'firebase/app';
import Timestamp = firebase.firestore.Timestamp;

export interface Track {
  added_at: Timestamp;
  added_at_day: number;
  added_at_hours: number;
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

export interface WebPlaybackState {
  context: {
    uri: string | null; // The URI of the context (can be null)
    metadata: Object | null; // Additional metadata for the context (can be null)
  };
  disallows: {
    // A simplified set of restriction controls for
    pausing: boolean; // The current track. By default, these fields
    peeking_next: boolean; // will either be set to false or undefined, which
    peeking_prev: boolean; // indicates that the particular operation is
    resuming: boolean; // allowed. When the field is set to `true`, this
    seeking: boolean; // means that the operation is not permitted. For
    skipping_next: boolean; // example, `skipping_next`, `skipping_prev` and
    skipping_prev: boolean; // `seeking` will be set to `true` when playing an
    // ad track.
  };
  paused: boolean; // Whether the current track is paused.
  position: number; // The position_ms of the current track.
  repeat_mode: number; // The repeat mode. No repeat mode is 0,
  // once-repeat is 1 and full repeat is 2.
  shuffle: boolean; // True if shuffled, false otherwise.
  track_window: {
    current_track: WebPlaybackTrack; // The track currently on local playback
    previous_tracks: WebPlaybackTrack[]; // Previously played tracks. Number can vary.
    next_tracks: WebPlaybackTrack[]; // Tracks queued next. Number can vary.
  };
}

export interface WebPlaybackTrack {
  uri: string; // Spotify URI
  id: string | null; // Spotify ID from URI (can be null)
  type: 'track' | 'episode' | 'ad'; // Content type: can be "track", "episode" or "ad"
  media_type: 'audio' | 'video'; // Type of file: can be "audio" or "video"
  name: string; // Name of content
  is_playable: boolean; // Flag indicating whether it can be played
  album: {
    uri: string; // Spotify Album URI
    name: string;
    images: { url: string }[];
  };
  artists: { uri: string; name: string }[];
}

export interface Devices {
  devices: Device[];
}

export interface Device {
  id: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number;
}
