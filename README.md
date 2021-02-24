# streamSaveJs

Save streaming audio (icecast, internet radio, etc...) locally

### Usage

`node index.js https://example.com/stream.mp3 60 --meta=cue`

First two arguments are `url` and `duration to record in seconds`

### TODOs and other resources

for handling playlists
* https://github.com/fent/node-m3u8stream

example of straight mp3 (any audio stream?) saving
* https://github.com/charlielee/mp3-stream-recorder

parsing icecast info
* https://github.com/TooTallNate/node-icy

some other resources
* https://github.com/radioangrezi/docker-streamripper
* https://github.com/clue/docker-streamripper
