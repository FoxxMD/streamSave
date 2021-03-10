import fs from 'fs';
import events from 'events';
import dayjs from 'dayjs';
import Mustache from 'mustache';
import icy from 'icy';
import preprocess from 'icy/lib/preprocessor.js';
import NodeID3 from 'node-id3';
import {
    icyRequest,
    cueStartChunk,
    generateCueChunk,
    randomId,
    createLabelledLogger,
    getExtensionFromContentType
} from "./util.js";
import path from "path";
import m3u8stream from 'm3u8stream';
import pEvent from 'p-event';

const {promises: fsasync} = fs;
const {Promise: id3} = NodeID3;

export default class CaptureTask {

    id;
    config;
    url;
    duration;
    emitter;
    logger;

    cueStream;
    outputStream;
    extension;
    unknownExtensionNotified = false;

    startTime;
    endTime;
    lastProgress;
    metaIndex = 1;

    constructor(url, duration, config = {}) {
        this.url = url;
        this.duration = duration;

        const {
            dir,
            id = randomId(),
            template = `{{hostname}}_{{id}}_{{date}}_{{time}}`,
            metadataBehavior = 'none',
            logger = createLabelledLogger(`Stream ${id}`, `Stream ${id}`),
            logProgressInterval = 5,
            progressInterval = 1,
            logProgress = false,
            emitter = new events.EventEmitter(),
        } = config;
        this.config = {
            dir,
            template,
            metadataBehavior,
            progressInterval: Math.min(Math.max(1, progressInterval), Math.max(logProgressInterval, 5)),
            logProgressInterval: Math.max(logProgressInterval, 5),
            logProgress
        }
        this.id = id;
        this.emitter = emitter;
        this.logger = logger;
    }

    defaultTemplateData = () => {
        const now = dayjs();
        const {hostname} = new URL(this.url);
        return {
            id: this.id,
            hostname,
            date: now.local().format('YYYY-MM-DD'),
            time: now.local().format('HH-mm-ss'),
            dt: () => (text, render) => {
                return now.local().format(text);
            }
        };
    }

    capture = async () => {

        const {
            metadataBehavior = 'none',
            template
        } = this.config;

        const urlInfo = new URL(this.url);
        const {hostname} = urlInfo;

        this.logger.info('Stream task initiated');

        const now = dayjs();
        const templateData = {
            id: this.id,
            hostname,
            date: now.local().format('YYYY-MM-DD'),
            time: now.local().format('HH-mm-ss'),
            dt: () => (text, render) => {
                return now.local().format(text);
            }
        }

        const filePath = this.getFilePath(template, templateData);
        const finalDir = path.dirname(filePath);

        if (!fs.existsSync(finalDir)) {
            await fsasync.mkdir(path.dirname(filePath), {recursive: true});
        }

        let metaHint = 'None';
        if (metadataBehavior === 'cue') {
            metaHint = 'Create .cue file';
        } else if (metadataBehavior === 'split') {
            metaHint = 'Create new file on metadata change';
        }
        this.logger.info(`Stream: ${this.url} | Duration: ${this.duration === 0 ? 'Forever' : `${this.duration}s`} | Metadata Behavior: ${metaHint}`);
        this.logger.info("Requesting stream...");

        try {
            if (this.url.includes('m3u8')) {
                throw new Error('playlists not yet supported');
                //await this.capturePlaylistStream();
            } else {
                await this.captureDirectStream();
            }
        } catch (e) {
            this.logger.error('Stream capture stopped due to error');
            this.logger.error(e);
        }
    }

    captureDirectStream = async () => {
        let res = await icyRequest(this.url);

        this.logger.info("Stream response OK!");

        const [ext, isAudio] = getExtensionFromContentType(res.res.headers['content-type'], this.url);
        if (!isAudio) {
            this.logger.warn('Could not determine if response was audio from extension or response Content-Type!');
        }
        this.extension = ext;

        const filePath = this.getFilePath(this.config.template);
        this.outputStream = this.createOutputStream(filePath);
        this.outputStream.on('finish', async () => this.onOutputFinish(filePath))
        this.startTime = dayjs();
        this.endTime = dayjs().add(this.duration, 's');

        res.on('metadata', async (metadata) => this.onMetadata(res, metadata));
        res.on('data', async (chunk) => this.onData(res, chunk));
        res.on('end', () => this.emitter.emit('captureFinish'));

        this.emitter.emit('captureStart');
        res.pipe(this.outputStream);

        await pEvent(this.emitter, 'captureFinish');
    }

    capturePlaylistStream = async () => {
        // this aint workin :/
        const m3Stream = await m3u8stream(this.url, {
            headers: {
                'Icy-MetaData': '1'
            }
        });
        m3Stream.once('socket', (socket) => preprocess(socket))
        m3Stream.on('response', async (resp) => {
            if (resp.headers['icy-metaint'] !== undefined) {

            }
            // resp.headers['content-type']
            //this.outputStream = fs.createWriteStream(this.getFilePath(this.metaIndex, {metaindex: this.metaIndex}));
            //this.metaIndex++;
            // await resp.pipe(this.outputStream);
        });
        m3Stream.on('progress', (prog) => {
            const e = prog;
            const l = 1;
        });
        m3Stream.on('data', (chunk) => this.onData(m3Stream, chunk));
        m3Stream.on('end', () => {
            this.logger.info('ending');
            this.emitter.emit('captureFinish');
        });

        this.outputStream = this.createOutputStream(this.getFilePath(this.config.template));
        m3Stream.pipe(this.outputStream);

        await pEvent(this.emitter, 'captureFinish');
    }

    onMetadata = async (readable, metadata) => {

        const {
            metadataBehavior = 'none',
            template,
        } = this.config;

        const parsed = icy.parse(metadata);
        const {StreamTitle = 'Unknown'} = parsed;
        const dur = dayjs.duration(dayjs().diff(this.startTime, 'ms'));
        const marker = {title: StreamTitle, duration: dur, index: this.metaIndex};
        this.logger.debug('New Metadata:', parsed);
        if (metadataBehavior === 'cue') {

            if (this.cueStream === null) {
                this.cueStream = fs.createWriteStream(`${this.getFilePath(template)}.cue`);
                this.cueStream.write(cueStartChunk);
                this.logger.info(`Wrote metadata change to cue file: ${StreamTitle}`);
            }
            this.cueStream.write(generateCueChunk(marker));

        } else if (metadataBehavior === 'split') {

            const metaNow = dayjs();
            const newFilePath = this.getFilePath(template, {
                metadata: StreamTitle,
                metaindex: this.metaIndex,
                metatime: metaNow.local().format('HH-mm-ss-SSS'),
                metadt: () => (text, render) => {
                    return metaNow.local().format(text);
                }
            });
            // remove previous write stream and close it out
            await readable.unpipe(this.outputStream);
            await this.outputStream.end();

            this.logger.info(`Starting new track on metadata change: ${StreamTitle}`);

            // create new write stream to new file path
            this.outputStream = this.createOutputStream(newFilePath);
            this.outputStream.on('finish', async () => this.onOutputFinish(newFilePath, StreamTitle))
            await readable.pipe(this.outputStream);
        }
        this.metaIndex++;
    }

    onData = (readable, chunk) => {
        const now = dayjs();
        if (this.lastProgress === null) {
            this.lastProgress = dayjs();
            this.logger.info('Stream capture started!');
        } else if (this.duration !== 0 && now.isAfter(this.endTime)) {
            this.logger.info('Duration reached, ending stream capture');
            readable.end();
        } else if (now.diff(this.lastProgress, 's') >= this.config.progressInterval) {
            const streamedFor = dayjs.duration(dayjs().diff(this.startTime, 'ms')).format('HH-mm-ss-SSS');
            this.emitter.emit('captureProgress', streamedFor);
            if (this.config.logProgress !== false && now.diff(this.lastProgress, 's') >= this.config.logProgressInterval) {
                this.logger.info(`Streamed ${streamedFor}`);
            }
            this.lastProgress = dayjs();
        }
    }

    onOutputFinish = (path, title = this.id) => async () => {
        if (this.extension === '.mp3') {
            const now = dayjs();
            await id3.write({
                title: title,
                audioSourceUrl: this.url,
                date: now.local().format('DDMM'),
                year: now.local().format('YYYY'),
                time: now.local().format('HHmm'),
                comment: {
                    language: 'eng',
                    text: 'captured with streamSave',
                }
            }, path);
        } else {
            this.logger.debug('Not writing ID3 tag because file is not explicitly a .mp3');
        }
    }

    createOutputStream = (filePath) => {
        this.logger.info(`Output To: ${filePath}`);
        if (this.extension === undefined && this.unknownExtensionNotified === false) {
            this.logger.warn('Could not determine file extension from URL or response Content-Type!');
            this.unknownExtensionNotified = true;
        }
        return fs.createWriteStream(filePath);
    }

    getFilePath = (template, context = {}, extension = this.extension) => {
        const templateData = {...this.defaultTemplateData(), ...context};
        const pathName = Mustache.render(template, templateData);
        return path.join(this.config.dir, `${pathName}${extension}`);
    }
}
