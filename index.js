import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import duration from 'dayjs/plugin/duration.js';
import record from './server/record.js';
import minimist from 'minimist';

dayjs.extend(utc);
dayjs.extend(duration);

(async function () {
    const argv = minimist(process.argv.slice(2));
    const {
        _: [
            url = process.env.URL,
            duration = process.env.DURATION
        ] = [],
        meta = process.env.META,
    } = argv;
    if (url === undefined) {
        throw new Error('url (first arg) must be defined');
    }
    if(duration === undefined) {
        throw new Error('duration (second arg) must be defined');
    }
    await record(url, duration, {metadataBehavior: meta});
}());
