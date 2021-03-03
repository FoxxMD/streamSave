import fs from "fs";
import dayjs from 'dayjs';
import Mustache from 'mustache';
import icy from 'icy';
import NodeID3 from 'node-id3';
import {icyRequest, cueStartChunk, generateCueChunk, randomId, createLabelledLogger} from "./util.js";
import path from "path";

const {Promise: id3} = NodeID3;

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
    const {hostname} = urlInfo;

    const logger = passedLogger || createLabelledLogger(`Stream ${id}`, `Stream ${id}`);

    logger.info('Stream task initiated');

    let template = nameTemplate;

    if (template === undefined) {
        template = `{{hostname}}_{{id}}_{{date}}_{{time}}`
    }

    const now = dayjs();
    const templateData = {
        id,
        hostname,
        date: now.local().format('YYYY-MM-DD'),
        time: now.local().format('HH-mm-ss'),
        dt: () => (text, render) => {
            return now.local().format(text);
        }
    }

    const filePath = getFilePath(dir, template, templateData);

    const finalDir = path.dirname(filePath);
    logger.info(`Output To: ${filePath}`);

    let metaHint = 'None';
    if (metadataBehavior === 'cue') {
        metaHint = 'Create .cue file';
    } else if (metadataBehavior === 'split') {
        metaHint = 'Create new file on metadata change';
    }
    logger.info(`Stream: ${url} | Duration: ${duration === 0 ? 'Forever' : `${duration}s`} | Metadata Behavior: ${metaHint}`);
    logger.info("Requesting stream...");

    // wait for response
    const res = await icyRequest(url);

    logger.info("Stream response OK!");

    if (!fs.existsSync(finalDir)) {
        logger.info('Creating output directory...')
        fs.mkdirSync(path.dirname(filePath));
    }
    let outputStream = fs.createWriteStream(filePath);

    // Counters
    let startTime = dayjs();
    let endTime = dayjs().add(duration, 's');
    let lastProgress = null;

    let cueStream = null;
    let metaIndex = 1;
    try {

        // set metadata event behavior
        res.on('metadata', async function (metadata) {
            const parsed = icy.parse(metadata);
            const {StreamTitle = 'Unknown'} = parsed;
            const dur = dayjs.duration(dayjs().diff(startTime, 'ms'));
            const marker = {title: StreamTitle, duration: dur, index: metaIndex};
            logger.debug('New Metadata:', parsed);
            if (metadataBehavior === 'cue') {

                if (cueStream === null) {
                    cueStream = fs.createWriteStream(`${filePath}.cue`);
                    cueStream.write(cueStartChunk);
                    logger.info(`Wrote new Metadata to cue file: ${StreamTitle}`);
                }
                cueStream.write(generateCueChunk(marker));

            } else if (metadataBehavior === 'split') {

                const metaNow = dayjs();
                const newFilePath = getFilePath(dir, template, {
                    ...templateData,
                    metadata: StreamTitle,
                    metaindex: metaIndex,
                    metatime: metaNow.local().format('HH-mm-ss-SSS'),
                    metadt: () => (text, render) => {
                        return metaNow.local().format(text);
                    }
                });
                // remove previous write stream and close it out
                await res.unpipe(outputStream);
                await outputStream.end();

                // create new write stream to new file path
                outputStream = fs.createWriteStream(newFilePath);
                outputStream.on('finish', async () => {
                    await id3.write({
                        title: StreamTitle,
                        trackNumber: metaIndex.toString(),
                        audioSourceUrl: url,
                        date: now.local().format('DDMM'),
                        year: now.local().format('YYYY'),
                        time: now.local().format('HHmm'),
                        comment: {
                            language: 'eng',
                            text: 'captured with streamSave',
                        }
                    }, newFilePath);
                });
                await res.pipe(outputStream);
                logger.info(`Started new track on new Metadata: ${StreamTitle}`);

            }
            metaIndex++;
        });

        // track streaming progress
        res.on('data', (chunk) => {
            const now = dayjs();
            if (lastProgress === null) {
                lastProgress = dayjs();
                logger.info('Stream capture started!');
            } else if (duration !== 0 && now.isAfter(endTime)) {
                logger.info('Duration reached, ending stream capture');
                res.end();
            } else if (progressInterval !== false && now.diff(lastProgress, 's') >= progressInterval) {
                const streamedFor = dayjs.duration(dayjs().diff(startTime, 'ms')).format('HH-mm-ss-SSS');
                logger.info(`Streamed ${streamedFor}`);
                lastProgress = dayjs();
            }
        });

        // initial write stream id3 write
        outputStream.on('finish', async () => {
            await id3.write({
                title: id,
                audioSourceUrl: url,
                date: now.local().format('DDMM'),
                year: now.local().format('YYYY'),
                time: now.local().format('HHmm'),
                comment: {
                    language: 'eng',
                    text: 'captured with streamSave',
                }
            }, filePath);
        });
        await res.pipe(outputStream);
    } catch (e) {
        logger.error(e);
        throw e;
    }
}

const getFilePath = (dir, template, context = {}) => {
    const pathName = Mustache.render(template, context);
    return path.join(dir, `${pathName}.mp3`);
}

export default record;
