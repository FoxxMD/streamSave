import winston from "winston";
import {readJson} from "./util.js";

export const validateProgram = (program, {
    configFilePath,
    logger = winston.loggers.get('app'),
    single = false,
} = {}) => {
    const {
        id,
        url,
        duration,
    } = program;

    if (id === undefined && !single) {
        logger.warn('Program did not have an `id`, a random one will be generated', {configFilePath})
    }
    if (url === undefined && !single) {
        logger.error(`Program ${id} did not have a 'url' property`, {configFilePath});
        throw Error('Program was not valid');
    }
    if (duration === undefined && !single) {
        logger.warn(`Program ${id} did not have a 'duration' property, will run indefinitely`, {configFilePath});
    }
}

export const parseProgramFile = async (pathname, {single} = {}) => {
    const program = await readJson(pathname);
    validateProgram(program, {configFilePath: pathname, single});
    return program;
}

export const parseConfigFile = async (pathname, {single} = {}) => {
    const config = await readJson(pathname);
    const {
        programs = [],
    } = config;
    for (const p of programs) {
        validateProgram(p, {configFilePath: pathname, single});
    }
    return config;
}
