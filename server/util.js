import icy from 'icy';
import dayjs from 'dayjs';

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
