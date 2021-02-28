#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { main } from './renderer';

const argv = yargs(hideBin(process.argv))
    .scriptName("gpx-to-instagram")
    .usage('Overlay Strava GPX track onto image.\nUsage: $0 -g Ride.gpx -i sky.jpg -d sky-ride.jpg')
    .option('g', {
        alias: 'gpx',
        describe: 'Input GPX file',
        demandOption: true,
        position: 0,
        type:'string'
    })
    .option('i', {
        alias: 'image',
        describe: 'Input image to be drawn on',
        demandOption: true,
        type:'string'
    })
    .option('o', {
        alias: 'output',
        describe: 'Output image path. Creates new image with o suffix.',
        demandOption: false,
        type:'string'
    })
    .option('a', {
        alias: 'athlete',
        describe: 'Athlete vanity sign.',
        default: '',
        demandOption: false,
        type:'string'
    })
    .help('help')
    .alias('help', 'h')
    .argv;

if (argv.g && argv.i) {
    const {g, i, o, a} = argv;
    main({g, i, o, a})
        .then(() => {
            console.log('Done!');
        })
        .catch((e) => {
            console.log('Error', e.message);
            process.exit(1);
        });
}
