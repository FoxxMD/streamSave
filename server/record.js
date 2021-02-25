import fs from "fs";
import {pipeline} from "stream";
import dayjs from 'dayjs';
import Mustache from 'mustache';
import icy from 'icy';
import {icyRequest, cueStartChunk, generateCueChunk, randomId, createLabelledLogger} from "./util.js";
import path from "path";

export const record = async (url, duration, options = {}) => {
    const {
        dir,
        id = randomId(),
        nameTemplate,
        metadataBehavior = 'none',
        logger: passedLogger,
        progressInterval = false,
    } = options;

    const urlInfo = new URL(url);
    const { hostname } = urlInfo;

    const logger = passedLogger || createLabelledLogger(`Stream ${id}`, `Stream ${id}`);

    logger.info('Stream task initiated');

    let template = nameTemplate;

    if(template === undefined) {
        template = `{{hostname}}_{{id}}_{{date}}_{{time}}`
    }

    const now = dayjs();
    const fileView = {
        id,
        hostname,
        date: now.local().format('YYYY-MM-DD'),
        time: now.local().format('HH-mm-ss'),
        dt: () => (text, render) => {
            return now.local().format(text);
        }
    }

    let templatedName = Mustache.render(template, fileView);

    const fileName = `${templatedName}.mp3`;
    const filePath = path.join(dir, fileName);

    const finalDir = path.dirname(filePath);
    logger.info(`Output To: ${finalPath}`);
    if (!fs.existsSync(finalDir)) {
        logger.info('Creating output directory...')
        fs.mkdirSync(path.dirname(filePath));
    }

    const outputStream = fs.createWriteStream(filePath);

    let metaHint = 'None';
    if(metadataBehavior === 'cue') {
        metaHint = 'Create .cue file';
    } else if (metadataBehavior === 'split') {
        metaHint = 'Create new file on metadata change';
    }
    logger.info(`Stream: ${url} | Duration: ${duration}s | Metadata Behavior: ${metaHint}`);
    logger.info("Starting stream capture...");

    // Counters
    let startTime = null;
    let endTime = dayjs().add(duration, 's');
    let lastProgress = null;

    let cueStream = null;
    let cueIndex = 0;
    let cueWroteOnce = false;
    if(metadataBehavior === 'cue') {
        cueStream = fs.createWriteStream(`${filePath}.cue`);
    }

    const req = icyRequest(url, (res) => {

        startTime = dayjs();
            res.on('metadata', function (metadata) {
                var parsed = icy.parse(metadata);
                const { StreamTitle = 'Unknown' } = parsed;
                const dur = dayjs.duration(dayjs().diff(startTime, 'ms'));
                cueIndex++;
                const marker = {title: StreamTitle, duration: dur, index: cueIndex};
                console.info('New Metadata:', parsed);
                if(cueStream !== null) {
                    if(cueWroteOnce === false) {
                        cueStream.write(cueStartChunk);
                    }
                    cueStream.write(generateCueChunk(marker));
                }
                // TODO split file behavior
            });

            res.on('data', (chunk) => {
                const now = dayjs();
            if(lastProgress === null) {
                lastProgress = dayjs();
                console.log('Streaming Started!');
            } else if(now.isAfter(endTime)) {
                console.log('Duration reached, ending stream capture');
                res.end();
            } else if(progressInterval !== false && now.diff(lastProgress, 's') >= progressInterval) {
                const streamedFor = dayjs.duration(dayjs().diff(startTime, 'ms')).format('HH:mm:ss');
                console.log(`Streamed ${streamedFor}`);
                lastProgress = dayjs();
            }
        });

            pipeline(res, outputStream, (done) => {
                if(done) {
                    console.error(done);
                }
            });
    });

    await req;
}

export default record;
