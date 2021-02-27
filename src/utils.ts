/**
 * In meters
 * @param lat1
 * @param lon1
 * @param lat2
 * @param lon2
 */
export function distanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export function bearing(lat1, lon1, lat2, lon2) {
    const λ1 = lon1 * Math.PI / 180; // φ, λ in radians
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians

    const λ2 = lon2 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;

    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);
    const brng = (θ * 180 / Math.PI + 360) % 360;
    return brng;
}

export function mercatorProjection(lat, lon, λ0 = 0) {
    //const λ0 = 0;
    const λ = lon * Math.PI / 180;
    const φ = lat * Math.PI / 180;
    const x = λ - λ0;
    const y = Math.log((1 + Math.sin(φ)) / (1 - Math.sin(φ))) / 2;
    return [x, y];
}


export const delay = (timeout) => {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, timeout);
    });
};
