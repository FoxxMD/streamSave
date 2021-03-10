import parser from 'cron-parser';
import dayjs from 'dayjs';
import {randomId} from "./util.js";

const {isDayjs} = dayjs;

export default class ScheduledEvent {

    id;
    rawData;
    scheduleData;
    duration;
    logger;

    constructor(config, logger) {
        const {
            id = randomId(),
            duration = 0,
            data = {}
        } = config;

        this.duration = duration;
        this.rawData = data;
        this.logger = logger;
        this.id = id;

        let validScheduleData = false;

        const errs = [];
        if (typeof data === 'string') {
            // could be a cron string or a date
            try {
                this.scheduleData = parser.parseExpression(data);
                validScheduleData = true;
            } catch (e) {
                // oops not a cron string
                errs.push(e);
            }

            if (validScheduleData === false) {
                const date = dayjs(data);
                if (isDayjs(date)) {
                    this.scheduleData = date;
                    validScheduleData = true;
                } else {
                    errs.push(new Error('dayjs could not parse string'));
                }
            }

            if (validScheduleData === false) {
                for (const e of errs) {
                    this.logger.error(e);
                }
                throw new Error(`Scheduled Event ${id} => string value given but could not parse as cron or date: ${data}`);
            }
        } else {
            const {
                start: startVal,
                end: endVal,
                cron,
            } = data;
            if (startVal === undefined) {
                throw new Error(`Scheduled Event ${id} => 'start' must be defined`);
            }
            const start = dayjs(startVal);
            if (!isDayjs(start)) {
                throw new Error(`Scheduled Event ${id} => Could not parse 'start' value as dayjs date`);
            }

            if (end === undefined) {
                throw new Error(`Scheduled Event ${id} => 'end' must be defined`);
            }
            const end = dayjs(endVal);
            if (!isDayjs(end)) {
                throw new Error(`Scheduled Event ${id} => Could not parse 'end' value as dayjs date`);
            }

            if (cron !== undefined) {
                try {
                    const interval = parser.parseExpression(cron);
                    this.scheduleData = {
                        start: start,
                        end: end,
                        rule: interval
                    };
                } catch (e) {
                    this.logger.error(e);
                    throw new Error(`Scheduled Event ${id} => Could not parse 'cron' value`);
                }
            } else {
                this.scheduleData = start;
                this.duration = end.diff(start, 's');
            }
        }

        if (duration === 0) {
            this.logger.warn(`Scheduled Event ${id} => No duration set, stream will be captured indefinitely!`);
        }
    }

    getScheduleData = () => {
        if (typeof this.scheduleData === 'string') {
            return this.scheduleData;
        } else if (isDayjs(this.scheduleData)) {
            return this.scheduleData.toDate();
        } else {
            const {start, end, ...rest} = this.scheduleData;
            return {
                start: start.toDate(),
                end: end.toDate(),
                ...rest,
            };
        }
    }
}
