import fs from "fs";
import {pipeline} from "stream";
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

    var output_file_name = `${fileName}.mp3`;
    var output_file_path = `${dir}/${output_file_name}`;
    var output_stream = fs.createWriteStream(output_file_path);

    console.log("Stream:", url, "Duration:", duration, "s");
    console.log("Running audio stream recorder...");

    // Counters
    let startTime = null;
    let endTime = dayjs().add(duration, 's');
    let lastConsoleProgress = null;

    //let markers = [];

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
                const now = dayjs();
            if(lastConsoleProgress === null) {
                lastConsoleProgress = dayjs();
                console.log('Streaming Started!');
            } else if(now.isAfter(endTime)) {
                console.log('Duration reached, ending stream capture');
                res.end();
            } else if(now.diff(lastConsoleProgress, 's') >= 5) {
                const streamedFor = dayjs.duration(dayjs().diff(startTime, 'ms')).format('HH:mm:ss');
                console.log(`Streamed ${streamedFor}`);
                lastConsoleProgress = dayjs();
            }
        });

            pipeline(res, output_stream, (done) => {
                if(done) {
                    console.error(done);
                }
            });
    });

    await req;
}

export default record;
