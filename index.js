import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import dduration from 'dayjs/plugin/duration.js';
import minimist from 'minimist';
import {Writable} from 'stream';
import winston from 'winston';
import 'winston-daily-rotate-file';

import {labelledFormat} from "./server/util.js";
import CaptureTask from "./server/CaptureTask.js";

dayjs.extend(utc);
dayjs.extend(dduration);

const {transports} = winston;

const argv = minimist(process.argv.slice(2));
const {
    _: [
        url,
        duration
    ] = [],
    meta,
    id,
    logLevel = process.env.LOG_LEVEL,
    logDir = process.env.LOG_DIR,
    port: serverPort = process.env.PORT,
    configDir: cDir = process.env.CONFIG_DIR,
    outputDir: oDir = process.env.OUTPUT_DIR,
    name,
} = argv;

let output = []
const stream = new Writable()
stream._write = (chunk, encoding, next) => {
    output.unshift(chunk.toString().replace('\n', ''));
    output = output.slice(0, 101);
    next()
}
const streamTransport = new winston.transports.Stream({
    stream,
})

const logConfig = {
    level: logLevel || 'info',
    sort: 'descending',
    limit: 50,
}

const availableLevels = ['info', 'debug'];
const logPath = logDir || `${process.cwd()}/logs`;
const port = serverPort ?? 9078;
const localUrl = `http://localhost:${port}`;
const outputDir = oDir || `${process.cwd()}/streams`

const rotateTransport = new winston.transports.DailyRotateFile({
    dirname: logPath,
    createSymlink: true,
    symlinkName: 'streamSave-current.log',
    filename: 'streamSave-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '5m'
});

const consoleTransport = new transports.Console();

const myTransports = [
    consoleTransport,
    streamTransport,
];

if (typeof logPath === 'string') {
    myTransports.push(rotateTransport);
}

const loggerOptions = {
    level: logConfig.level,
    format: labelledFormat(),
    transports: myTransports,
};

winston.loggers.add('default', loggerOptions);

const logger = winston.loggers.get('default');

const configDir = cDir || `${process.cwd()}/config`;

(async function () {

    if (url !== undefined || duration !== undefined) {
        logger.info('Detected url and duration arguments, starting in one-off mode');
        // run once mode!
        if (url === undefined) {
            throw new Error('url (first arg) must be defined');
        }
        if (duration === undefined) {
            throw new Error('duration (second arg) must be defined');
        }
        const task = new CaptureTask(url, duration, {metadataBehavior: meta, id, dir: outputDir, template: name})

        await task.capture();
    }
}());
