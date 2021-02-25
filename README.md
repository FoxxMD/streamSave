# streamSaveJs

Save streaming audio (icecast, internet radio, etc...) locally

## Usage

Minimal example -- only `url` and `duration` are required

`node index.js [url] [duration] [...optionalArgs]`

| Name        | Default     | Description                                                          |
|-------------|-------------|----------------------------------------------------------------------|
| url         |             | streaming media EX http://exmaple.com/sample.aac                     |
| duration    |             | # of seconds to capture stream                                       |
| --meta      |             | Behavior on stream metadata change                                   |
| --id        |             | Friendly name for logging and filename (see below)                   |
| --name      |             | Mustache-templated name for stream file (see below)                  |
| --outputDir | CWD/streams | Base directory to output files to                                    |
| --configDir | CWD/config  | Base directory to look for configs in                                |
| --logDir    | CWD/logs    | Base directory to output log files to. `false` disables file logging |

## Output Files and Logging

Output provides sane defaults with granular control over location and naming depending on which of these options you specify.

### ID

If no `id` is specified a random string like `yfid78g7` will be generated for each stream. Log entries will be prefixed with `id`.

### Name

The output filename is templated using [mustache.js](https://github.com/janl/mustache.js)

If `name` is not specified the default output template is:

```{{hostname}}_{{id}}_{{date}}_{{time}}```

Example:

```example.org_yfid78g7_2021-02-25_16-06-36```

with the full output path being:

```CWD/streams/example.org_yfid78g7_2021-02-25_16-06-36.mp3```

**Name Templating**

The following template variables are available:

| Name                     | Description                                                                                                    |
|--------------------------|----------------------------------------------------------------------------------------------------------------|
| `{{id}}`                 |                                                                                                                |
| `{{hostname}}`           | domain name of the streaming url                                                                               |
| `{{date}}`               | Date in the format `YYYY-MM-DD` EX `2020-01-15`                                                                |
| `{{time}}`               | Time in the format `HH-mm-ss` EX `16-06-36`                                                                    |
| `{{#dt}}[format]{{/dt}}` | A datetime formatting function that accepts a [DayJS](https://day.js.org/docs/en/display/format) format string |

You may also include directory seperators for your system to fully control the final file path. An example using all of the above:

```
node index.js https://example.com/sample.aac 30 --id=mySpecificStream --name="{{hostname}}/{{#dt}}YYYY-MM{{/dt}}/{{#dt}}DD{{/dt}}/{{id}}_{{time}}"
```
```
CWD/streams/example.com/2021-02/25/mySpecificStream_16-06-36.mp3
```

### TODOs and other resources

for handling playlists
* https://github.com/fent/node-m3u8stream

some other resources
* https://github.com/radioangrezi/docker-streamripper
* https://github.com/clue/docker-streamripper
