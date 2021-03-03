# streamSaveJs

Save streaming audio (icecast, internet radio, etc...) locally

## Usage

Minimal example -- only `url` and `duration` are required

`node index.js [url] [duration] [...optionalArgs]`

| Name        | Default     | Description                                                          |
|-------------|-------------|----------------------------------------------------------------------|
| url         |             | streaming media EX http://exmaple.com/sample.aac                     |
| duration    |             | # of seconds to capture stream, 0 = forever                          |
| --meta      |             | Behavior on stream metadata change, default is to do nothing         |
| --id        |             | Friendly name for logging and filename (see below)                   |
| --name      |             | Mustache-templated name for stream file (see below)                  |
| --outputDir | CWD/streams | Base directory to output files to                                    |
| --configDir | CWD/config  | Base directory to look for configs in                                |
| --logDir    | CWD/logs    | Base directory to output log files to. `false` disables file logging |

## Metadata Behavior

### Split

Setting `--meta=split` will cause a new file to be created each time the stream emits new metadata. Most internet radio streams will emit metadata when the currently playing media changes.

### Cue

Setting `--meta=cue` will write to a [cue file](https://en.wikipedia.org/wiki/Cue_sheet_(computing)) when the stream emits new metadata. The `.cue` file will have the same name as the stream file.

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

If you use `meta=split` these variables will become available when the first metadata is emitted. Until first metadata the filename will be rendered without these variables.

| Name                             | Description                                                   |
|----------------------------------|---------------------------------------------------------------|
| `{{metadata}}`                   | Stream name from metadata                                     |
| `{{metaindex}}`                  | "Track" number based on how many files have been split        |
| `{{metatime}}`                   | Time when track was split in format HH-mm-ss-SSS              |
| `{{#metadt}}[format]{{/metadt}}` | Same functionality as `dt` template variable but for metatime |

You may also include directory seperators for your system to fully control the final file path. An example:

```
node index.js https://example.com/sample.aac 30 --id=mySpecificStream --name="{{hostname}}/{{#dt}}YYYY-MM{{/dt}}/{{#dt}}DD{{/dt}}/{{id}}_{{time}}"
```
```
CWD/streams/example.com/2021-02/25/mySpecificStream_16-06-36.mp3
```
