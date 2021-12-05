import functions = require('firebase-functions');
export const nova = [
  {
    novaChannel: 'Radio Nova',
    playlistId: functions.config().nova.radio,
    frequence: '910',
  },
  {
    novaChannel: 'Nouvo nova',
    playlistId: functions.config().nova.nouvo,
    frequence: '79676',
  },
  {
    novaChannel: 'Nova la nuit',
    playlistId: functions.config().nova.nuit,
    frequence: '916',
  },
  {
    novaChannel: 'Nova classics',
    playlistId: functions.config().nova.classics,
    frequence: '913',
  },
  {
    novaChannel: 'Nova danse',
    playlistId: functions.config().nova.danse,
    frequence: '560',
  },
];

export const limitTracksToCheck = 10;
