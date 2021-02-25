import icy from 'icy';
import dayjs from 'dayjs';
import winston from "winston";
import jsonStringify from 'safe-stable-stringify';

const {format} = winston;
const {combine, printf, timestamp, label, splat, errors} = format;

// export const promisfyIcyRequest = async (options, func) => {
//     return new Promise((resolve, reject) => {
//         const req = lib.request(params, res => {
//             if (res.statusCode < 200 || res.statusCode >= 300) {
//                 return reject(new Error(`Status Code: ${res.statusCode}`));
//             }
//
//             const data = [];
//
//             res.on('data', chunk => {
//                 data.push(chunk);
//             });
//
//             res.on('end', () => resolve(Buffer.concat(data).toString()));
//         });
//
//         req.on('error', reject);
//
//         if (postData) {
//             req.write(postData);
//         }
//
//         // IMPORTANT
//         req.end();
//     });
// };
// }

export const icyRequest = async (url, func, options = {}) => {
    const {
        body,
        method = 'GET',
    } = options;
    const urlInfo = new URL(url);
    const {
        host,
        pathname: path,
        protocol,
    } = urlInfo;

    // const protocol = url.startsWith('https://') ? 'https' : 'http';
    //
    // const [h, path] = url.split('://')[1].split('/');
    // const [host, port] = h.split(':');
    //
    // const params = {
    //     method,
    //     host,
    //     port: port || url.startsWith('https://') ? 443 : 80,
    //     path: path || '/',
    // };
    const params = {
        host,
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

           const data = [];

           res.on('data', chunk => {
               data.push(chunk);
           });

           res.on('end', () => resolve(Buffer.concat(data).toString()));

           func(res);

            // res.on('metadata', function (metadata) {
            //
            //     var parsed = icy.parse(metadata);
            //     console.error(parsed);
            // });
        });
        // const req = lib.request(params, res => {
        //     if (res.statusCode < 200 || res.statusCode >= 300) {
        //         return reject(new Error(`Status Code: ${res.statusCode}`));
        //     }
        //
        //     const data = [];
        //
        //     res.on('data', chunk => {
        //         data.push(chunk);
        //     });
        //
        //     res.on('end', () => resolve(Buffer.concat(data).toString()));
        // });

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
