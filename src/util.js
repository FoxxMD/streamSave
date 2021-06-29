import icy from 'icy';
import dayjs from 'dayjs';
import winston from "winston";
import jsonStringify from 'safe-stable-stringify';
import mime from 'mime-types';
import path from 'path';
import {constants, promises} from "fs";

const {format} = winston;
const {combine, printf, timestamp, label, splat, errors} = format;

export const icyRequest = async (url, func, options = {}) => {
    const {
        body,
        method = 'GET',
    } = options;
    const urlInfo = new URL(url);
    const {
        hostname,
        port,
        pathname: path,
        protocol,
    } = urlInfo;

    const params = {
        host: hostname,
        port,
        path,
        protocol,
        method,
        ...options,
    };

    return new Promise((resolve, reject) => {
        const req = icy.request(params, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Status Code: ${res.statusCode}`));
            }
            resolve(res);
        });

        req.on('error', reject);

        if (body !== undefined) {
            req.write(body);
        }

        // IMPORTANT
        req.end();
    });
};

export const generateCue = (markers) => {
return `PERFORMER ""
  TITLE ""
  FILE "" MP3` +
    markers.map(({duration, title}, i) => {
        const time = duration.format('HH:mm:ss:SSS');
        return `
    TRACK ${String(i+1).padStart(2, '0')} AUDIO
      PERFORMER ""
      TITLE "${title}"
      INDEX 01 ${time}`;
    }).join('');
};

export const cueStartChunk = `PERFORMER ""
  TITLE ""
  FILE "" MP3`;

export const generateCueChunk = ({title, duration, index}) => {
    const time = duration.format('HH:mm:ss:SSS');
    return `
    TRACK ${String(index).padStart(2, '0')} AUDIO
      PERFORMER ""
      TITLE "${title}"
      INDEX 01 ${time}`;
}

const s = splat();
const SPLAT = Symbol.for('splat')
const errorsFormat = errors({stack: true});
const CWD = process.cwd();

let longestLabel = 3;
export const defaultFormat = printf(({level, message, label = 'App', timestamp, [SPLAT]: splatObj, stack, ...rest}) => {
    let stringifyValue = splatObj !== undefined ? jsonStringify(splatObj) : '';
    if (label.length > longestLabel) {
        longestLabel = label.length;
    }
    let msg = message;
    let stackMsg = '';
    if (stack !== undefined) {
        const stackArr = stack.split('\n');
        msg = stackArr[0];
        const cleanedStack = stackArr
            .slice(1) // don't need actual error message since we are showing it as msg
            .map(x => x.replace(CWD, 'CWD')) // replace file location up to cwd for user privacy
            .join('\n'); // rejoin with newline to preserve formatting
        stackMsg = `\n${cleanedStack}`;
    }

    return `${timestamp} ${level.padEnd(7)}: [${label.padEnd(longestLabel)}] ${msg}${stringifyValue !== '' ? ` ${stringifyValue}` : ''}${stackMsg}`;
});


export const labelledFormat = (labelName = 'App') => {
    const l = label({label: labelName, message: false});
    return combine(
        timestamp(
            {
                format: () => dayjs().local().format(),
            }
        ),
        l,
        s,
        errorsFormat,
        defaultFormat,
    );
}

export const createLabelledLogger = (name = 'default', label = 'App') => {
    if (winston.loggers.has(name)) {
        return winston.loggers.get(name);
    }
    const def = winston.loggers.get('default');
    winston.loggers.add(name, {
        transports: def.transports,
        level: def.level,
        format: labelledFormat(label)
    });
    return winston.loggers.get(name);
}

// https://gist.github.com/6174/6062387#gistcomment-2651745
export const randomId = (length = 8) => [...Array(length)].map(i=>(~~(Math.random()*36)).toString(36)).join('')

export const getExtensionFromContentType = (contentType, url = undefined) => {

    let isAudio = false;
    let ext = url !== undefined ? path.extname(url) : undefined;
    if(ext === '') {
        ext = undefined;
    }
    if (ext !== undefined) {
        const type = mime.lookup(ext);
        isAudio = type.includes('audio');
    }
    if (!isAudio) {
        const ct = mime.contentType(contentType);
        isAudio = contentType.includes('audio') || (ct !== false && ct.includes('audio'));
        ext = mime.extension(contentType);

        if (ct !== false) {
            const extensions = mime.extensions[ct];
            if (extensions !== undefined) {
                if (extensions.includes('mp3')) {
                    ext = '.mp3'
                } else {
                    ext = mime.extension(ct)
                }
            } else {
                // exceptions :(
                if (ct.includes('aac')) {
                    ext = '.aac';
                }
                // leave blank for more later
            }
        }
    }

    return [ext, isAudio];
}


export async function readJson(p, {logErrors = true, throwOnNotFound = true, logger = winston.loggers.get('app')} = {}) {
    try {
        const realPath = await promises.realpath(p);
        await promises.access(realPath, constants.R_OK);
        const data = await promises.readFile(realPath);
        return JSON.parse(data);
    } catch (e) {
        const {code} = e;
        if (code === 'ENOENT') {
            if (throwOnNotFound) {
                if (logErrors) {
                    logger.warn('No file found at given path', {filePath: p});
                }
                throw e;
            } else {
                return;
            }
        } else if (logErrors) {
            logger.warn(`Encountered error while parsing file`, {filePath: p});
        }
        throw e;
    }
}
