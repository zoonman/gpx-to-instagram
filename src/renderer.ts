import { GpxToInstagramParams } from './types/gpx-params';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { parse } from 'fast-xml-parser';
import { createCanvas, loadImage } from 'canvas';
import { extname, join } from 'path';
import { distanceInMeters, mercatorProjection } from './utils';
import { SingleBar } from 'cli-progress';


function assertExtensions(name: string, extensions: string[], message: string) {
    const lcname = extname(name).toLowerCase();
    const match = extensions.reduce((pv: boolean, cv) => {
        return pv || lcname.endsWith(`${cv}`);
    }, false);
    if (!match) {
        throw new Error(message);
    }
}

export async function main(params: GpxToInstagramParams): Promise<void> {

    assertExtensions(params.g, ['.gpx'], 'Incorrect GPX file name');
    if (!existsSync(params.g)) {
        throw new Error('Unreadable GPX file');
    }

    assertExtensions(
        params.i,
        ['.jpg', '.jpeg', '.png', '.gif'],
        'Incorrect image file name'
    );

    if (!existsSync(params.i)) {
        throw new Error('Unreadable image file');
    }

    console.log('Reading GPX file', params.g);
    const fileData = readFileSync(params.g);
    const xmlObj = parse(fileData.toString(), {
        ignoreAttributes: false,
        attributeNamePrefix: ''
    });
    const {gpx} = xmlObj;
    const {trk} = gpx;
    const {trkseg} = trk;
    const {trkpt} = trkseg;

    console.log('Reading image file', params.i);
    const image = await loadImage(params.i);
    const logo = await loadImage(
        join(__dirname, 'strava_symbol_white.png')
    );

    const {width: imageWidth, height: imageHeight} = image;
    const width = Math.min(imageWidth, imageHeight);
    const height = Math.min(imageWidth, imageHeight);

    const margin = {
        left: width * 0.01,
        top: height * 0.05,
        right: width * 0.05,
        bottom: height * 0.10,
    };

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, (width - imageWidth) / 2 , (height - imageHeight) / 2);

    ctx.strokeStyle = 'rgba(255,0,0,1)';
    ctx.lineWidth = Math.min(width, height) * 0.005;

    let activeTime = 0;

    const slidingSpeeds = Array(5).fill(0);
    let myMaxSpeed = 0;
    let pEle = 0;
    let myClimb = 0;

    console.log('Preparing the data');
    const protp = trkpt.map((p, i, a) => {
        const {lat, lon, ele} = p;

        const mp = mercatorProjection(lat, lon);

        const distance = (i == 0) ? 0 : distanceInMeters(a[i - 1].lat, a[i - 1].lon, lat, lon);
        let speed = 0;

        if (i != 0) {
            const t0 = Date.parse(a[i - 1].time);
            const t1 = Date.parse(p.time);
            const dt = t1 - t0;
            speed = distance / dt * 1000; // because of ms above

            slidingSpeeds.shift();
            slidingSpeeds.push(speed);

            const newMaxSpeed = slidingSpeeds.reduce((a, c) => a + c) / slidingSpeeds.length;
            myMaxSpeed = newMaxSpeed > myMaxSpeed ? newMaxSpeed : myMaxSpeed;

            if (distance > 3) {
                activeTime += dt / 1000;
            }

            if (ele > pEle) {
                if (ele - pEle >= 0.25) {
                    // console.log('Elevation', ele - pEle, ele, pEle);
                } else {
                    myClimb += ele - pEle;
                }
            }
        } else {
            myClimb = 0;
        }
        pEle = ele;

        return {
            ...p,
            mp,
            speed,
            distance
        };
    });

    const mp = trkpt.map(p => mercatorProjection(p.lat, p.lon));
    const elvs = trkpt.map(p => p.ele);
    const speeds = protp.map(p => p.speed);
    const maxSpeed = Math.max(...speeds);
    const avgSpeed = speeds.reduce((a, v) => (a + v)) / speeds.length;

    const maxEle = Math.max(...elvs);
    const minEle = Math.min(...elvs);
    const dEle = maxEle - minEle;

    const xs = mp.map(p => p[0]);
    const ys = mp.map(p => p[1]);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);

    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const dX = maxX - minX; // longitude = x
    const dY = maxY - minY; // latitude = y

    const scale = Math.min(
        (width - margin.left - margin.right) / dX,
        (height - margin.top - margin.bottom - height * 0.04) / dY
    );

    let i;

    const lingrad2 = ctx.createLinearGradient(0, height / 2, 0, height);
    lingrad2.addColorStop(0, 'rgba(0, 0, 0, 0)');
    lingrad2.addColorStop(1, 'rgba(0, 0, 0, 0.85)');

    // assign gradients to fill and stroke styles
    ctx.fillStyle = lingrad2;
    ctx.fillRect(0, height / 2, width, height / 2);

    let speed = 0, ele = trkpt[0].ele;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    let px, py;
    let totalDistance = 0;

    ctx.shadowBlur = width * 0.01;
    ctx.shadowColor = 'rgba(255,255,255,0.5)';
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    const bar1 = new SingleBar({
        format: 'Rendering map [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}'
    });

    bar1.start(protp.length, 0);

    for (i = 0; i < protp.length; i += 1) {
        const {
            distance,
            speed,
            ele,
            mp,
            lat, lon
        } = protp[i];
        const [x0, y0] = mp;

        const x = Math.round((width - dX * scale) / 2 + (x0 - minX) * scale);
        const y = Math.round((height - margin.bottom + margin.top ) / 2 - (y0 - minY) * scale + dY * scale / 2);
        totalDistance += distance;
        // console.log(i, x, y,  xyRatio,'|', x0.toFixed(6), y0.toFixed(6), '|', lat, lon, '|',  distance.toFixed(3), '|', (speed * 3.6).toFixed(3), '|', ele, trkpt[i].time);
        //
        const sq = (speed * 0.7 / maxSpeed + 0.3).toFixed(2);
        const el = 255 - (ele - minEle) / dEle * 250;

        ctx.beginPath();
        if (i > 0) {
            ctx.moveTo(px, py);
        }
        ctx.strokeStyle = `hsla(${ el },90%,50%,${ sq })`;
        ctx.lineTo(x, y);
        px = x;
        py = y;
        ctx.stroke();
        bar1.increment();
    }
    bar1.update(protp.length);
    bar1.stop();

    ctx.font = `${ (height * 0.03).toFixed(0) }px DIN Alternate`;
    ctx.fillStyle = 'White';

    const avgSpeedTxt = (avgSpeed * 3.6).toFixed(1);

    const xGrid = (width - margin.left - margin.right) / 4;
    const xGridOffset = (n) => (margin.left + xGrid * n);

    function renderMetric(label, value, unit, x, y) {
        ctx.shadowBlur = width * 0.1;

        ctx.fillStyle = 'hsla(0,0%,100%,0.75)';
        ctx.font = `100 ${ (height * 0.03).toFixed(0) }px 'DIN Condensed'`;

        const tm = ctx.measureText(unit == 'km/h' ? 'km' : `${ unit }`);
        const uPos = xGrid - tm.width;

        ctx.font = `100 ${ (height * 0.04).toFixed(0) }px "SF UI Display"`;
        ctx.textAlign = 'right';
        ctx.fillText(label, x + uPos, y);

        ctx.font = `${ (height * 0.09).toFixed(0) }px DIN Alternate`;
        ctx.textAlign = 'right';


        ctx.fillStyle = 'hsla(0,0%,100%,0.5)';
        ctx.shadowBlur = width * 0.001;
        const bY = y + height * 0.08;
        ctx.fillText(`${ value }`, x + uPos, bY);
        ctx.textAlign = 'left';


        ctx.font = `100 ${ (height * 0.03).toFixed(0) }px 'DIN Condensed'`;

        if (unit == 'km/h') {

            ctx.fillText(`km`, x + uPos, y + height * 0.05);
            ctx.beginPath();
            ctx.strokeStyle = 'hsla(0,0%,100%,0.75)';
            ctx.lineWidth = Math.min(width, height) * 0.001;

            ctx.moveTo(x+uPos, y + height * 0.055);
            ctx.lineTo(x+uPos+tm.width, y + height * 0.055);
            ctx.stroke();
            ctx.textAlign = 'center'
            ctx.fillText(`h`, x + uPos + tm.width/2, bY);

        } else {
            ctx.fillText(`${ unit }`, x + uPos, bY);
        }
    }

    const bottomMetricsY = height - margin.bottom

    console.log('Rendering metrics');

    renderMetric('Distance', (totalDistance / 1000).toFixed(1), 'km', xGridOffset(0), bottomMetricsY);
    renderMetric('Avg Speed', avgSpeedTxt, 'km/h', xGridOffset(1), bottomMetricsY);

    const maxSpeedTxt = (myMaxSpeed * 3.6).toFixed(1);

    renderMetric('Max Speed', maxSpeedTxt, 'km/h', xGridOffset(2), bottomMetricsY);
    renderMetric('Elevation', (myClimb).toFixed(0), 'm', xGridOffset(3), height * 3 / 4);


    const t0 = Date.parse(protp[0].time);
    const t1 = Date.parse(protp[protp.length - 1].time);
    const sec = (t1 - t0) / 1000;
    const hrs = Math.floor(sec / 3600).toFixed(0);
    const min = (sec / 60 % 60).toFixed();

    const ts = sec / 3600 > 1.0 ? `${ hrs }h${ min }` : `${ min }`;

    renderMetric('Total Time', ts, 'm', xGridOffset(3), bottomMetricsY);

    ctx.shadowBlur = 0;
    ctx.textAlign = 'right';
    const branding = logo.height * 0.8;
    const brandingText = `${params.a}`;
    ctx.font = `${ branding }px DIN Alternate`;
    const btx = ctx.measureText(brandingText);
    ctx.drawImage(logo, width - margin.right - logo.width - btx.width, margin.top);

    ctx.fillText(brandingText, width - margin.right, margin.top + branding);

    const { o } = params;
    let outputFile = 'out.jpg';
    if (o) {
        outputFile = o;
    }
    console.log('Writing image file', outputFile);

    const ext = extname(outputFile).toLowerCase();
    let buffer;
    switch(ext) {
        case 'png':
            buffer = canvas.toBuffer('image/png');
            break;
        default:
            buffer = canvas.toBuffer('image/jpeg');
    }
    if (buffer) {
        writeFileSync(outputFile, buffer);
    }
    return;
}
