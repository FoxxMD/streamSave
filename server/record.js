// Check the output directory exists
import fs from "fs";
import {pipeline} from "stream";
// import fetch from "node-fetch";
import dayjs from 'dayjs';
import Mustache from 'mustache';
import icy from 'icy';
import {icyRequest, cueStartChunk, generateCueChunk} from "./util.js";

export const record = async (url, duration, options = {}) => {
    const {
        dir = './shows',
        id,
        nameTemplate,
        metadataBehavior = 'none',
    } = options;

    if (!fs.existsSync(dir)) {
        console.log("Created output directory:", dir)
        fs.mkdirSync(dir);
    }

    const urlInfo = new URL(url);

    let template = nameTemplate;
    if(template === undefined) {
        const { hostname } = urlInfo;
        if(id === undefined) {
            template = `${hostname} - {{date}}`;
        } else {
            template = `{{id}} - ${hostname} - {{date}}`;
        }
    }

    const fileView = {
        id,
        date: dayjs().local().toISOString()
    }

    let fileName = Mustache.render(template, fileView);

// Windows does not allow colons in file names
    //var output_file_date = new Date().toISOString().replace(/:/g, "-");

    var output_file_name = `${fileName}.mp3`;
    var output_file_path = `${dir}/${output_file_name}`;
    var output_stream = fs.createWriteStream(output_file_path);

// Streams
    var stream_url = 'https://pba-ice.wabe.org/wabe.aac';
//var stream = request.get(stream_url);

    console.log("Stream:", url, "Duration:", duration, "s");
    console.log("Running audio stream recorder...");

// Counters
    let startTime = null;
    let lastConsoleProgress = null;

    //const streamPipeline = promisify(pipeline);

    //const response = await fetch(stream_url);
    // const icyRequest = icy.request({
    //     host: urlInfo.host,
    //     path: urlInfo.pathname,
    //     protocol: urlInfo.protocol,
    // }, (res) => {
    //     res.on('metadata', function (metadata) {
    //         var parsed = icy.parse(metadata);
    //         console.error(parsed);
    //     });
    // });
    //
    // const p = promisify(icyRequest);
    // const response = await p;

    let markers = [];

    let cueStream = null;
    let cueIndex = 0;
    let cueWroteOnce = false;
    if(metadataBehavior === 'cue') {
        cueStream = fs.createWriteStream(`${output_file_path}.cue`);
    }

    const req = icyRequest(url, (res) => {

        startTime = dayjs();
            res.on('metadata', function (metadata) {
                var parsed = icy.parse(metadata);
                const { StreamTitle = 'Unknown' } = parsed;
                const dur = dayjs.duration(dayjs().diff(startTime, 'ms'));
                //markers.push({title: StreamTitle, duration: dur})
                cueIndex++;
                const marker = {title: StreamTitle, duration: dur, index: cueIndex};
                console.info('New Metadata:', parsed);
                if(cueStream !== null) {
                    if(cueWroteOnce === false) {
                        cueStream.write(cueStartChunk);
                    }
                    cueStream.write(generateCueChunk(marker));
                }
            });

            res.on('data', (chunk) => {
            if(lastConsoleProgress === null) {
                lastConsoleProgress = dayjs();
                console.log('Streaming Started!');
            } else if(dayjs().diff(lastConsoleProgress, 's') >= 5) {
                const streamedFor = dayjs.duration(dayjs().diff(startTime, 'ms')).format('HH:mm:ss');
                console.log(`Streamed ${streamedFor}`);
                lastConsoleProgress = dayjs();
            }
        });

            pipeline(res, output_stream, (done) => {
                if(done) {
                    console.error(done);
                }
                // if(metadataBehavior === 'cue') {
                //     fs.writeFile(`${output_file_path}.cue`, generateCue(markers), (err) => {
                //         if(err) {console.error(err);}
                //     })
                // }
            });
    });

    await req;

    // response.body.on('data', (chunk) => {
    //     console.log('getting chunk');
    // })

    //await streamPipeline(response.body, output_stream);
}

export default record;
