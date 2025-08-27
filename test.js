/* eslint-env jest */

jest.mock('play-dl', () => ({
  playlist_info: jest.fn(),
}));

jest.mock('ngrok', () => ({
  connect: jest.fn(),
}));

jest.mock('discord.js', () => {
  const originalModule = jest.requireActual('discord.js');
  const EmbedBuilder = jest.fn(() => ({
    setColor: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
  }));
  return {
    ...originalModule,
    EmbedBuilder,
  };
});

const createMockTrack = (id, title = 'Test Song', duration = 180000, uri = 'https://youtube.com/test') => ({
  encoded: `encoded_track_${id}`,
  info: {
    identifier: id,
    title,
    duration,
    uri,
    author: 'Test Author',
    artworkUrl: 'https://youtube.com/thumbnail.jpg',
    isSeekable: true,
  },
  requester: 'TestUser#0001',
  userData: {},
});

const mockPlayer = {
  queue: {
    current: null,
    tracks: [],
    add: jest.fn((track, index) => {
      const tracksToAdd = Array.isArray(track) ? track : [track];
      if (typeof index === 'number') {
        mockPlayer.queue.tracks.splice(index, 0, ...tracksToAdd);
      } else {
        mockPlayer.queue.tracks.push(...tracksToAdd);
      }
    }),
    shuffle: jest.fn(() => {
        mockPlayer.queue.tracks.sort(() => Math.random() - 0.5);
    }),
    clear: jest.fn(() => {
        mockPlayer.queue.tracks = [];
    }),
    remove: jest.fn((index, count = 1) => mockPlayer.queue.tracks.splice(index, count)),
    get size() {
        return this.tracks.length;
    }
  },
  connected: false,
  playing: false,
  paused: false,
  voiceChannelId: null,
  textChannelId: null,
  position: 0,
  _lastSeek: null,
  repeatMode: 'off',
  state: "DISCONNECTED",
  connect: jest.fn(function() {
    this.connected = true;
    this.voiceChannelId = '123456789';
    this.state = "CONNECTED";
    return Promise.resolve(this);
  }),
  play: jest.fn(function(options) {
    if(options && options.track) {
        this.queue.current = options.track;
    }
    if (this.queue.current || this.queue.tracks.length > 0) {
      if(!this.queue.current) {
        this.queue.current = this.queue.tracks.shift();
      }
      this.playing = true;
      this.paused = false;
    }
    return Promise.resolve(this);
  }),
  pause: jest.fn(function() {
      this.playing = false;
      this.paused = true;
      return Promise.resolve(this);
  }),
  resume: jest.fn(function() {
      this.playing = true;
      this.paused = false;
      return Promise.resolve(this);
  }),
  stop: jest.fn(function() {
    this.playing = false;
    this.queue.current = null;
    return Promise.resolve(this);
  }),
  destroy: jest.fn(function() {
    this.connected = false;
    this.playing = false;
    this.paused = false;
    this.voiceChannelId = null;
    this.queue.current = null;
    this.queue.tracks = [];
    this.state = "DISCONNECTED";
    this._lastSeek = null;
    return Promise.resolve(this);
  }),
  skip: jest.fn(function(amount = 1) {
    if (!this.queue.current) return Promise.resolve(this);
    for(let i = 0; i < amount - 1; i++) {
        if(this.queue.tracks.length > 0) this.queue.tracks.shift();
    }
    this.queue.current = this.queue.tracks.shift() || null;
    if (!this.queue.current) {
      this.playing = false;
    }
    return Promise.resolve(this);
  }),
  seek: jest.fn(function(newPosition) {
    this.position = newPosition;
    return Promise.resolve(this);
  }),
  search: jest.fn(async ({ query }) => {
    if (query === 'no results') {
      return { loadType: 'empty', tracks: [] };
    }
    if (query.includes('playlist')) {
        return {
            loadType: 'playlist',
            playlist: { name: 'Test Playlist', duration: 720000 },
            tracks: [createMockTrack('pl1'), createMockTrack('pl2'), createMockTrack('pl3'), createMockTrack('pl4')],
        }
    }
    return {
      loadType: 'search',
      tracks: [createMockTrack(query)],
    };
  }),
  setRepeatMode: jest.fn(function(mode) {
    this.repeatMode = mode;
  }),
  set: jest.fn(),
  get: jest.fn(),
};

const mockClient = {
  lavalink: {
    getPlayer: jest.fn(() => mockPlayer),
    createPlayer: jest.fn(() => {
      mockPlayer.connect();
      return mockPlayer;
    }),
    nodeManager: {
        nodes: new Map([['Main Node', {
            connected: true,
            stats: { players: 1, playingPlayers: 1, uptime: 123456, ping: 50 },
            info: { version: { semver: '3.7.0' } }
        }]])
    }
  },
  user: {
      tag: 'TestBot#0000',
      displayAvatarURL: jest.fn(() => 'https://cdn.discordapp.com/avatar.png'),
  },
  ws: {
      ping: 100
  },
  channels: {
      cache: {
          get: jest.fn(() => ({
              send: jest.fn().mockResolvedValue(true)
          }))
      }
  }
};

const createMockInteraction = (options = {}) => ({
  options: {
    getString: jest.fn((name) => options[name] || null),
    getInteger: jest.fn((name) => options[name] || null),
    getSubcommand: jest.fn(() => options.subcommand || null),
    getAttachment: jest.fn(),
  },
  member: {
    voice: {
      channel: {
        id: '123456789',
      },
      channelId: '123456789'
    },
  },
  channel: {
    id: 'channel123',
    send: jest.fn().mockResolvedValue(true),
  },
  guild: {
    id: 'guild123',
  },
  guildId: 'guild123',
  user: {
    id: 'user123',
    tag: 'TestUser#0001',
  },
  reply: jest.fn().mockResolvedValue(true),
  editReply: jest.fn().mockResolvedValue(true),
  deferReply: jest.fn().mockResolvedValue(true),
  fetchReply: jest.fn(() => Promise.resolve({ createdTimestamp: Date.now() })),
  createdTimestamp: Date.now(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.destroy();
  mockClient.lavalink.getPlayer.mockReturnValue(mockPlayer);
  mockClient.lavalink.createPlayer.mockReturnValue(mockPlayer);
});


describe('Utility Functions', () => {
    function formatDuration(ms) {
        if (!ms || ms < 0) ms = 0;
        const s = Math.floor((ms / 1000) % 60),
            m = Math.floor((ms / 60000) % 60),
            h = Math.floor((ms / 3600000) % 24);
        if (h > 0)
            return `${h}:${m.toString().padStart(2, "0")}:${s
            .toString()
            .padStart(2, "0")}`;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }

    test('formatDuration should format milliseconds correctly', () => {
        expect(formatDuration(0)).toBe('00:00');
        expect(formatDuration(59000)).toBe('00:59');
        expect(formatDuration(60000)).toBe('01:00');
        expect(formatDuration(3600000)).toBe('1:00:00');
        expect(formatDuration(3661000)).toBe('1:01:01');
        expect(formatDuration(null)).toBe('00:00');
    });
});

describe('Utils - playlist.js', () => {
    const { fetchYouTubePlaylist } = require('./utils/playlist');
    const playdl = require('play-dl');
    
    test('should fetch and map playlist videos correctly', async () => {
        const mockPlaylistData = {
            all_videos: jest.fn().mockResolvedValue([
                { title: 'Video 1', url: 'url1' },
                { title: 'Video 2', url: 'url2' },
            ]),
        };
        playdl.playlist_info.mockResolvedValue(mockPlaylistData);

        const result = await fetchYouTubePlaylist('https://youtube.com/playlist?list=123');
        
        expect(playdl.playlist_info).toHaveBeenCalledWith('https://youtube.com/playlist?list=123', { incomplete: true });
        expect(mockPlaylistData.all_videos).toHaveBeenCalled();
        expect(result).toEqual([
            { title: 'Video 1', url: 'url1' },
            { title: 'Video 2', url: 'url2' },
        ]);
    });

    test('should return null if play-dl throws an error', async () => {
        playdl.playlist_info.mockRejectedValue(new Error('API error'));
        const result = await fetchYouTubePlaylist('invalid_url');
        expect(result).toBeNull();
    });
});


describe('Commands', () => {
  describe('/help', () => {
    const helpCommand = require('./commands/help.js');
    
    test('should show help embed with navigation buttons', async () => {
      const interaction = createMockInteraction();
      interaction.editReply.mockResolvedValue({ createMessageComponentCollector: () => ({ on: jest.fn() }) });
      await helpCommand.execute(interaction, mockClient);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
      
      const replyCall = interaction.editReply.mock.calls[0][0];
      expect(replyCall.embeds[0].setTitle).toHaveBeenCalledWith("👋 Hey! Need help?");
      expect(replyCall.components).toBeDefined();
    });
  });

  describe('/ping', () => {
    const pingCommand = require('./commands/ping.js');

    test('should reply with latency and server status', async () => {
      const interaction = createMockInteraction();
      await pingCommand.execute(interaction, mockClient);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
      const embed = interaction.editReply.mock.calls[0][0].embeds[0];
      expect(embed.setTitle).toHaveBeenCalledWith('🏓 Pong!');
    });
  });

  describe('/play', () => {
    const playCommand = require('./commands/play.js');

    test('should create player, search and play if queue is empty', async () => {
      const interaction = createMockInteraction({ music: 'test song' });
      mockClient.lavalink.getPlayer.mockReturnValue(null);

      await playCommand.execute(interaction, mockClient);
      
      expect(mockClient.lavalink.createPlayer).toHaveBeenCalled();
      expect(mockPlayer.connect).toHaveBeenCalled();
      expect(mockPlayer.search).toHaveBeenCalledWith({ query: 'test song' }, interaction.user);
      expect(mockPlayer.queue.add).toHaveBeenCalledWith([expect.any(Object)]);
      expect(mockPlayer.play).toHaveBeenCalled();
    });

    test('should add song to queue if already playing', async () => {
      mockPlayer.queue.current = createMockTrack('current');
      mockPlayer.playing = true;
      const interaction = createMockInteraction({ music: 'another song' });

      await playCommand.execute(interaction, mockClient);

      expect(mockPlayer.search).toHaveBeenCalledWith({ query: 'another song' }, interaction.user);
      expect(mockPlayer.queue.add).toHaveBeenCalledWith([expect.any(Object)]);
      expect(mockPlayer.play).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
      const embed = interaction.editReply.mock.calls[0][0].embeds[0];
      expect(embed.setTitle).toHaveBeenCalledWith('✅ Added to Queue');
    });

    test('should handle playlists', async () => {
        const interaction = createMockInteraction({ music: 'some playlist' });
        await playCommand.execute(interaction, mockClient);

        expect(mockPlayer.search).toHaveBeenCalledWith({ query: 'some playlist' }, interaction.user);
        expect(mockPlayer.queue.add).toHaveBeenCalledWith(expect.any(Array));
        expect(mockPlayer.queue.tracks.length).toBe(3);
    });

    test('should show error if user is not in a voice channel', async () => {
      const interaction = createMockInteraction({ music: 'test' });
      interaction.member.voice.channel = null;
      interaction.member.voice.channelId = null;

      await playCommand.execute(interaction, mockClient);
      
      const embed = interaction.editReply.mock.calls[0][0].embeds[0];
      expect(embed.setDescription).toHaveBeenCalledWith('❌ You need to be in a voice channel!');
    });
  });

  describe('/pause & /resume', () => {
    const pauseCommand = require('./commands/pause.js');
    const resumeCommand = require('./commands/resume.js');

    beforeEach(() => {
        mockPlayer.connect();
        mockPlayer.playing = true;
        mockPlayer.paused = false;
        mockPlayer.queue.current = createMockTrack('pausable');
    });

    test('/pause should pause the player', async () => {
      const interaction = createMockInteraction();
      
      await pauseCommand.execute(interaction, mockClient);

      expect(mockPlayer.pause).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });

    test('/resume should resume the player', async () => {
      mockPlayer.playing = false;
      mockPlayer.paused = true;
      const interaction = createMockInteraction();
      
      await resumeCommand.execute(interaction, mockClient);
      
      expect(mockPlayer.play).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });

  describe('/skip', () => {
      const skipCommand = require('./commands/skip.js');

      beforeEach(() => {
          mockPlayer.connect();
          mockPlayer.queue.current = createMockTrack('song1');
      });

      test('should skip the current song', async () => {
          mockPlayer.queue.tracks.push(createMockTrack('song2'));
          const interaction = createMockInteraction();

          await skipCommand.execute(interaction, mockClient);

          expect(mockPlayer.skip).toHaveBeenCalledWith(1);
          expect(interaction.editReply).toHaveBeenCalled();
      });

      test('should skip multiple songs', async () => {
          mockPlayer.queue.tracks.push(createMockTrack('song2'), createMockTrack('song3'));
          const interaction = createMockInteraction({ amount: 2 });

          await skipCommand.execute(interaction, mockClient);
          
          expect(mockPlayer.skip).toHaveBeenCalledWith(2);
      });

       test('should stop the player if skipping all songs', async () => {
          mockPlayer.queue.tracks.push(createMockTrack('song2'));
          const interaction = createMockInteraction({ amount: 2 });

          await skipCommand.execute(interaction, mockClient);
          
          expect(mockPlayer.stop).toHaveBeenCalled();
          expect(mockPlayer.queue.clear).toHaveBeenCalled();
      });
  });

  describe('/stop', () => {
    const stopCommand = require('./commands/stop.js');

    test('should destroy the player', async () => {
      mockPlayer.connect();
      const interaction = createMockInteraction();
      await stopCommand.execute(interaction, mockClient);
      
      expect(mockPlayer.destroy).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  describe('/forward & /rewind', () => {
    const forwardCommand = require('./commands/forward.js');
    const rewindCommand = require('./commands/rewind.js');
    
    beforeEach(() => {
        mockPlayer.connect();
        mockPlayer.queue.current = createMockTrack('seekable', 'Seekable Song', 300000);
        mockPlayer.position = 100000;
        mockPlayer._lastSeek = null;
    });

    test('/forward should seek forward in the current track', async () => {
      const interaction = createMockInteraction({ seconds: 30 });
      await forwardCommand.execute(interaction, mockClient);

      expect(mockPlayer.seek).toHaveBeenCalledWith(130000);
    });

    test('/rewind should seek backward in the current track', async () => {
      const interaction = createMockInteraction({ seconds: 20 });
      await rewindCommand.execute(interaction, mockClient);

      expect(mockPlayer.seek).toHaveBeenCalledWith(80000);
    });
  });

  describe('/lock & /unlock', () => {
    const lockCommand = require('./commands/lock.js');
    const unlockCommand = require('./commands/unlock.js');

    beforeEach(() => {
        mockPlayer.queue.current = createMockTrack('lockable');
    });

    test('/lock should set repeat mode to "track"', async () => {
        mockPlayer.repeatMode = 'off';
        const interaction = createMockInteraction();
        await lockCommand.execute(interaction, mockClient);

        expect(mockPlayer.setRepeatMode).toHaveBeenCalledWith('track');
    });

     test('/unlock should set repeat mode to "off"', async () => {
        mockPlayer.repeatMode = 'track';
        const interaction = createMockInteraction();
        await unlockCommand.execute(interaction, mockClient);

        expect(mockPlayer.setRepeatMode).toHaveBeenCalledWith('off');
    });
  });

  describe('/queue', () => {
      const queueCommand = require('./commands/queue.js');

      beforeEach(() => {
          mockPlayer.connect();
      });
      
      describe('subcommand: view', () => {
          test('should show the current queue', async () => {
              mockPlayer.queue.current = createMockTrack('q1', 'Song 1');
              mockPlayer.queue.tracks = [ createMockTrack('q2', 'Song 2'), createMockTrack('q3', 'Song 3') ];
              const interaction = createMockInteraction({ subcommand: 'view' });
              interaction.editReply.mockResolvedValue({ createMessageComponentCollector: () => ({ on: jest.fn() }) });
              
              await queueCommand.execute(interaction, mockClient);

              expect(interaction.deferReply).toHaveBeenCalled();
              const embed = interaction.editReply.mock.calls[0][0].embeds[0];
              expect(embed.setTitle).toHaveBeenCalledWith('📜 Queue');
          });
      });

      describe('subcommand: shuffle', () => {
          test('should shuffle the queue', async () => {
              mockPlayer.queue.tracks = [createMockTrack('a'), createMockTrack('b'), createMockTrack('c')];
              const interaction = createMockInteraction({ subcommand: 'shuffle' });

              await queueCommand.execute(interaction, mockClient);
              
              expect(mockPlayer.queue.shuffle).toHaveBeenCalled();
          });
      });
      
      describe('subcommand: loop', () => {
          test('should enable queue loop', async () => {
              mockPlayer.repeatMode = 'off';
              const interaction = createMockInteraction({ subcommand: 'loop' });
              
              await queueCommand.execute(interaction, mockClient);

              expect(mockPlayer.setRepeatMode).toHaveBeenCalledWith('queue');
          });
      });

      describe('subcommand: remove', () => {
          test('should remove a song from the specified position', async () => {
              mockPlayer.queue.current = createMockTrack('a');
              mockPlayer.queue.tracks = [createMockTrack('b', 'Song B'), createMockTrack('c', 'Song C')];
              const interaction = createMockInteraction({ subcommand: 'remove', position: 3 });

              await queueCommand.execute(interaction, mockClient);

              expect(mockPlayer.queue.tracks.length).toBe(1);
              expect(mockPlayer.queue.tracks[0].info.title).toBe('Song B');
          });
      });
  });
});
