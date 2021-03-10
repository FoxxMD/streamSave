import fs, {promises} from 'fs';
import path from 'path';
import {addAsync, Router} from '@awaitjs/express';
import express from 'express';
import bodyParser from 'body-parser';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import dduration from 'dayjs/plugin/duration.js';
import calendarPlugin from 'dayjs/plugin/calendar.js';
import minimist from 'minimist';
import {Writable} from 'stream';
import winston from 'winston';
import 'winston-daily-rotate-file';
import schedule from 'node-schedule';

import {labelledFormat, readJson} from "./src/util.js";
import CaptureTask from "./src/CaptureTask.js";
import Program from "./src/Program.js";

dayjs.extend(utc);
dayjs.extend(dduration);
dayjs.extend(calendarPlugin);

const {transports} = winston;
const {Job} = schedule;

const argv = minimist(process.argv.slice(2));
const {
    _: [
        url,
        duration
    ] = [],
    logLevel = process.env.LOG_LEVEL,
    logDir = process.env.LOG_DIR,
    port: serverPort = process.env.PORT,
    configDir: cDir = process.env.CONFIG_DIR,
    outputDir = process.env.OUTPUT_DIR,
    single,
    ...cliRest
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
const logPath = logDir ?? `${process.cwd()}/logs`;
const port = serverPort ?? 9078;
const localUrl = `http://localhost:${port}`;

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

const configDirVal = cDir ?? `${process.cwd()}/config`;

(async function () {

    let cliMode = url !== undefined || duration !== undefined || single;

    let defaults = {
        outputDir: outputDir ?? `${process.cwd()}/streams`
    };
    let programs = [];
    let scheduledJobsData = [];
    let executedJobsData = [];
    let configDir;
    // load all configs
    try {
        configDir = await promises.realpath(configDirVal);
    } catch (e) {
        if (!cliMode) {
            logger.error('Exception occurred while reading config path');
            logger.error(e);
            throw e;
        }
    }

    let files = [];
    if (configDir !== undefined) {
        try {
            files = await promises.readdir(configDir);
        } catch (e) {
            if (!cliMode) {
                logger.error('Exception occurred while reading files in config path');
                logger.error(e);
                throw e;
            }
        }
    }

    for (const f of files) {
        if (f === 'config.json') {
            try {
                const configDefaults = await readJson(path.join(configDir, f));
                defaults = {...defaults, ...configDefaults};
            } catch (e) {
                if (!cliMode) {
                    logger.error('Exception occurred while reading config file');
                    throw e;
                }
            }
        } else if(path.extname(f) === '.json') {
            try {
                const programData = await readJson(path.join(configDir, f));
                const program = new Program({id: path.basename(f, '.json'), ...programData});
                programs.push(program);
            } catch (e) {
                if (!cliMode) {
                    logger.error('Exception occurred while reading program file');
                    throw e;
                }
            }
        }
    }

    if (cliMode) {
        let program = {};
        if (single !== undefined) {
            if (single === true) {
                // allow execution if there is only program present from config parsing
                if (programs.length === 1) {
                    program = programs[0];
                    logger.info(`Single Mode => Using Program ${program.id}`);
                } else {
                    logger.error(`Single Mode => No argument passed and more than one Program found while parsing configurations`);
                    process.exit(1);
                }
            } else {
                // assuming value passed in single is either a filepath or an id
                // check ids first
                program = programs.find(x => x.id === single);
                if (program !== undefined) {
                    logger.info(`Single Mode => Using Program with id ${single}`);
                } else {
                    // try filepath
                    try {
                        const programData = await readJson(single);
                        program = new Program(programData);
                    } catch (e) {
                        logger.error(`No Program with the id ${single} and parsing as path produced an error`);
                        process.exit(1);
                    }
                }
            }
        }

        const {
            url: pUrl = url,
            duration: pDuration = duration,
            outputDir: od = defaults.outputDir,
            ...progRest
        } = program;
        if (pUrl === undefined) {
            throw new Error('Single Mode => url must be defined');
        }
        const task = new CaptureTask(pUrl, pDuration, {...progRest, ...cliRest, dir: od})

        await task.capture();
    } else {
        // server mode
        const app = addAsync(express());
        const router = Router();

        app.use(router);
        app.use(bodyParser.json());

        scheduledJobsData = programs.reduce((acc, program) => {
            return acc.concat(program.scheduledEvents.map(se => {
                    const task = new CaptureTask(program.url, se.duration,
                        {
                            template: program.template,
                            onExistingFile: program.onExistingFile,
                            metadataBehavior: program.metadataBehavior
                        });
                    const data = {
                        program,
                        scheduledEvent: se,
                        job: schedule.scheduleJob(se.getScheduleData(), async () => {
                            se.logger.debug(`${se.id} => Im scheduled!`);
                            await task.capture();
                        }),
                    };
                    se.logger.info(`Scheduled Event ${se.id} => Scheduled for ${dayjs(data.job.nextInvocation()).calendar()}`)
                }
            ));
        }, [])
            .flat(2);

        // TODO check if any programs should be running now

        logger.info(`Server started at ${localUrl}`);
        await app.listen(port)
    }
}());
