// for handling playlists
// https://github.com/fent/node-m3u8stream

// example of straight mp3 (any audio stream?) saving
// https://github.com/charlielee/mp3-stream-recorder

// parsing icecast info
// https://github.com/TooTallNate/node-icy

// some other resources
// https://github.com/radioangrezi/docker-streamripper
// https://github.com/clue/docker-streamripper

// https://pba-ice.wabe.org/wabe.aac


// Dependencies
//import fs, {createWriteStream} from 'fs';
//import {pipeline} from 'stream';
//import {promisify} from 'server/util';
//import fetch  from 'node-fetch';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import duration from 'dayjs/plugin/duration.js';
import record from './server/record.js';

dayjs.extend(utc);
dayjs.extend(duration);

//var fs = require('fs');
//var NodeID3 = require('node-id3');
//var argv = require('minimist')(process.argv.slice(2));
//var request = require('request');

// DURATION OF STREAM IN MILLISECONDS
const DURATION = 5000;

(async function () {

    await record('https://pba-ice.wabe.org/wabe.aac', 10, {metadataBehavior: 'cue'});
}());

// stream.on("response", function(response) {
//     start_time = Date.now();
//
//     stream.on('data', function(chunk) {
//         // Calculate the time we have been streaming for
//         cur_time = Date.now();
//         cur_length = cur_time - start_time
//
//         // Abort the stream when the duration is passed
//         if (cur_length >= DURATION) {
//             stream.abort();
//             console.log("Finished. Output to:", output_file_name)
//
//             // Send a get request via IFTTT (key is a command line argument)
//             if (argv.ifttt_event && argv.ifttt_key) {
//                 console.log("Sending a notification to IFTTT")
//                 request.post({
//                         url: `https://maker.ifttt.com/trigger/${argv.ifttt_event}/with/key/${argv.ifttt_key}`,
//                         form: {"value1": output_file_name}},
//                     function (err, httpResponse, body) {
//                         console.log("Response:", body);
//                         if (err) {
//                             console.error(err);
//                         }
//                     });
//             }
//         }
//     })
//         .on('error', function(err) {
//             // handle error
//             console.error(err)
//         });
//
//     stream.pipe(output_stream);
// })
