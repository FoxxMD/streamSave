import {createLabelledLogger, randomId} from "./util.js";
import ScheduledEvent from "./ScheduledEvent.js";

export default class Program {

    id;
    template;
    metadataBehavior;
    logToFile;
    onExistingFile;
    url;
    logger;
    configPath;

    scheduledEvents = [];

    constructor(config) {
        const {
            id,
            template = `{{hostname}}_{{id}}_{{date}}_{{time}}`, // TODO move this into config defaults
            logToFile = false,
            metadataBehavior = 'none',
            onExistingFile = 'unique',
            url,
            logger: l,
            configPath,
            schedule = [],
            // convenience property for config files
            // if schedule data doesn't include end data but duration is present we can infer it
            duration,
        } = config;

        this.id = id ?? randomId();
        this.logger = l ?? createLabelledLogger(`Program ${this.id}`, `Program ${id}`);

        if (id === undefined) {
            this.logger.warn(`The 'id' ${id} was generated because this program did not have one`, {configPath})
        }

        if (url === undefined) {
            this.logger.error(`Cannot create Program ${id} because no 'url' is defined`, {configPath});
            throw Error(`Cannot create Program ${id} because no 'url' is defined`);
        }

        this.url = url;
        this.template = template;
        this.metadataBehavior = metadataBehavior;
        this.onExistingFile = onExistingFile;
        this.logToFile = logToFile;
        this.configPath = configPath;

        const scheduleData = typeof schedule === 'string' ? [schedule] : schedule;

        for (const sd of scheduleData) {
            try {
                const rawConfig = typeof sd === 'string' ? {data: sd, duration} : sd;
                const event = new ScheduledEvent(rawConfig, this.logger);
                this.scheduledEvents.push(event);
            } catch (e) {
                this.logger.error('Could not create Scheduled Event due to invalid data')
                this.logger.error(e);
            }
        }
    }

}
