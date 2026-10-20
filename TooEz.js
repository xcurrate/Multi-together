const fs = require('fs');
const { PNG } = require('pngjs');

const FILE_INPUT = 'L.png';
const AMBANG_WARNA = 45;
const LUAS_MINIMUM = 20;
const UKURAN = 64;
const ROTASI_MIN = -45;
const ROTASI_MAX = 45;
const ROTASI_STEP = 3;
const AMBANG_COCOK = 0.45;


const TEMPLATES = {
    J: "iVBORw0KGgoAAAANSUhEUgAAABUAAAAZCAYAAADe1WXtAAAAg0lEQVR4AbXBQZKDMAADwZEq//+yVgcfUpTZAMbdYkGKQcUgFqSYMC9TmYdSnDAbmA3Mi1SU2cA8kOIfZgOzgXmJisHclOKHD5ViULHIKb5kYIF5gYov5oYUF5gJFQvMRIoF5qIUEyoORKV4SMWB2UAMKW5SMSEOUlyg4oQ4kWJCxQ9/VpFAHzkkTOUAAAAASUVORK5CYII=",
    K: "iVBORw0KGgoAAAANSUhEUgAAABsAAAAfCAYAAAAWRbZDAAAAwklEQVR4Ab3BSY6EQBAEQY8U//9yjh84IFRUsw1mYafFQMRDxYeKf9BiYOFlLdRiZ+ElLSaiYqPFDS0mIlScEHGgxUTEqnigxUTExsJNLQ5EDCxc1GIi4kBxQYuJiInipBYTET+EVYsbIk4qHoi4oPhQ8UCLC4oPFSdFDLQ4KaxaDERstBiI+KFQi4GIFxUXRQy0+KH4UPGiFhPFDRE3FDdFDLQ4UC0GIl5WPBAx0GKgIj4SXtBiIGKj+FB4UYudiNUftOxoOtVWtw4AAAAASUVORK5CYII=",
    Q: "iVBORw0KGgoAAAANSUhEUgAAABcAAAAaCAYAAABctMd+AAAAqklEQVR4AbXBUY6DMBAFwX5z/ztPeiV/IGSbTYAqvtHiC2GjxYWIhTDR4ksRJ+GkxY8iDsJBi5sihjC0WIg4aLERoaAWExEbLSYiVCxEXIiYaKFqcUPEQjERcVOreEDERPGi4kXFi4oXFQ9oMVH8oAc2omKixUKLocVGRUy0+IcWC8VGi5OICxEKQ4sHRAzFEPGwcNLipgiFhRY35A8XWixEDC0OIp7UA8MH+ihwEy9/tQ8AAAAASUVORK5CYII=",
    R: "iVBORw0KGgoAAAANSUhEUgAAABUAAAAaCAYAAABYQRdDAAAAfElEQVR4AbXBQQ6EMBADwbbF/78860MOCGVBhEyViApeUHBDRAUfKRjMJhUMZqMKwvyhgQUiKrhQ8KCCCdPAfKBgwjQwH1RwoTANVMEmCsI0ONhAwYnZoIITVXChYKKCGwrCvKCBB2aBghumgWlgGpgGpoFpYBqIRRVMKH54tTA99zSSWQAAAABJRU5ErkJggg==",
    Y: "iVBORw0KGgoAAAANSUhEUgAAABcAAAAeCAYAAADHJYVoAAAApElEQVR4AbXBQZICMRADwZL248vLGx04TBC2sWE6UxW8UXADM1DBDcxEBT8SUcGAgg8qmDCNzEIFCxVMKEwoaGC+VMGEghAXFQwouKhgQsGLaWQOVTCh4MJcKFioYELBG7OhggUFA2ZTBYfEQAWbFEyYHyhYMI3ERAULCj4wX1CwwRxSsMk0Mo1MI9PIDFRwA3NAwQHTyDQyjf4YeLz8BxeP4MAT/WlMRb1KZAUAAAAASUVORK5CYII=",
    M: "iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAYAAADE6YVjAAAAh0lEQVR4Ab3BORaDMBAFwZ7/uP+Vxx04ILBYBFZV8VCLgRLaUIuBEg+lxaQWF4QFwokWk1ooJf4sLBAuaPFAmNRip8RAWCAMlNhpMSksEBYIB0rstPihxIGwQJjQ4oZwosRD4aYWN4WBFi9ohQWCShwoMVDiRHhRiR/CAhsXlVqcKDHSX/zBB8E7RChKcCZQAAAAAElFTkSuQmCC",
    F: "iVBORw0KGgoAAAANSUhEUgAAABMAAAAdCAYAAABIWle8AAAAYUlEQVR4Aa3BgQnEMBDEQN3i/lu+3xSQgHnNYNiihhdbXJotJEEURAfBFHV4McWlIAqiIAqiINiihtriT/OgthAEURAdBFPU4cMUF4IoiIIoiIIoiEJNIQgftrgQREEURD/GPxw5j8j/OQAAAABJRU5ErkJggg==",
    E: "iVBORw0KGgoAAAANSUhEUgAAABUAAAAdCAYAAABFRCf7AAAAVElEQVR4AbXBQQ4CMQzAQMfa/3+5BInrXlA9w9f54ZI5i8skIAEJSODhxSz+JAEJSEACEpizuGiWBCQgAQk8vJjFnyQgAQlIQAISmLO4TAISkIAEPugmFDJzUAT9AAAAAElFTkSuQmCC",
    
        O: "iVBORw0KGgoAAAANSUhEUgAAABkAAAAaCAYAAABCfffNAAAArUlEQVR4Ab3BQQ6DMBAEwZ79/583fcgBWTZYgVAVNrUYRGwIJ1psilgIEy1+FDEIgxY3RRyEgxYPifgKBy0WIgYtTkQofLWYiLjQYiJCxYmIDRETLVSoxU0RC8VCxANaxQuqxUMiJooXFC8oXlARf1Y8qMVEsdDiIcWfRYUiJlpsarFQXGhxocVEhMJBixMRBy1ORCgMWjwg4itMtLgh4iAstPhBxCBcaLEhYuED3XdkJQq4CZsAAAAASUVORK5CYII=",
    A: "iVBORw0KGgoAAAANSUhEUgAAABgAAAAbCAYAAABm409WAAAAnklEQVR4AbXBQQ7DIBRDwfet3v/KrhdZRAgaSGGmWOBgoIIOcZiY5OAFsYmDDjHBwUviMPHAwR/ECxV0OGiIHxwMVDBBLKpggRhwsIE4THQ46KjggYMb8YcKHoiGg44KXhAHOLgUNw42qSDEYeIwcXFwQHFx0KjgxsGCig/hYEIFDQc/iIEKJtSFATk4qAgHNxUsctBRbOKgo9jIQeMLVglcE3TZZdEAAAAASUVORK5CYII=",
    I: "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAXCAYAAAA2jw7FAAAAR0lEQVR4AYXBwQ2AQBDDQK/773nJg8fphMjMbHCY4CCFXDY4SCGFFFI4wQ/5sMFLCimkkGJ4bXCZkEIKKaSQYjhscJFCCikezVoUJK6AQdMAAAAASUVORK5CYII=",
    U: "iVBORw0KGgoAAAANSUhEUgAAABMAAAAYCAYAAAAYl8YPAAAAZElEQVR4Aa3BQQ7CMBRDwWff/84fV8oCRaEV4BlNsFHwYIKNKTJFpsgUmSJTZIpMkSkyRabIFJkiU2SKTJEpMgcT3JjgQBPcULBM8IEuxAR/0oVlgh8pCPFmgi8pWMTBBA8UbF4Dligfz9c27wAAAABJRU5ErkJggg==",
        H: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAYCAYAAAD6S912AAAAXElEQVR4Aa3BQQqEQBAEwezE/3+5t44iAy5SEUNscDPBiw0eJtygSMqkTMqkTMqkTMouDjb4SMqkTMqk7OJgghcbHEiZlEnRhpRJmZRJmRxs8NEQG9xM8IcNbiZ+DQIkIxQMRfIAAAAASUVORK5CYII=",
    S: "iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAAoklEQVR4Aa3BQQ7DIBAEwR7+/+dNR+JgISDYTlXYKLEQsRAmStwQcREGJR6I6MJFiRciFC5KTER0JTbyRVdiImKhxERjI2IjYqKxUeKBxg8lbgoXJTYiDoRBiQMRC2GixKGIQdgocSiiCwdKHIhQuKnERr5KDCJ+KDERNR6KWGhMlHihRfxZY6E6FkoshK7ESxFqdBF/EgYlHojowkKJAxGDDzsiZBndoZt2AAAAAElFTkSuQmCC",
    V: "iVBORw0KGgoAAAANSUhEUgAAABUAAAAbCAYAAACTHcTmAAAAjElEQVR4AbXBQRKEIBRDwZfU3P/Kf7JwYVGoINItFlXQEAsq6DAfU/wqaChYYDoqWGA2sIKOCl4yoeBD5kYFL5iDgkUKwjyoYJI5UTCoggtmQAUTTEPBIjOogkGmQ8ECc0FBo4ILCg5mA3NDQaOCB2YDMaCCBwoOZgMzQMEEs4GYUEGHghOzgZmgYMAf6mI4PRHAPtIAAAAASUVORK5CYII=",
        P: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAbCAYAAAB836/YAAAAcklEQVR4Aa3BMRIEIQwDwbGK/3/Zp2ADArjAqLvaeFDGRjxqYyMC2viIkDas2ghaXJTxRxsHIkyEiaEyDsRQGwciTAy0cVFYGwFlIkyElGGLR2VsFkNlHCwuyhgQYSJMXLQxIMJEmAgTYSKs+LSxKWPgByf7LDNiF5gVAAAAAElFTkSuQmCC",
    W: "iVBORw0KGgoAAAANSUhEUgAAAB8AAAAcCAYAAACZOmSXAAAArElEQVR4AcXBQQ6EMBADwbbF/7886wOHKAI2oASqxEsq6JgPbTxQwQEFN2xEBR0Fk1RwwBV8xAomqWCQwpyoYDETCj5gJqtgkLlQQaeChoKHzE7By8wEChoVDDANBZ0KJlMQ5kOmo+ABBY0K/jADKljALFbBCXNAwQMKGhVcMIMq6Ci4ScHOnFCwmLmhgj8UDDIfMhcULGQWUDDA/KFgEfMiBY2NRRTMUjsm+gHkn1BIUaJUPwAAAABJRU5ErkJggg==",
    
    B: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAZCAYAAAAxFw7TAAAAiElEQVR4Aa3BUYpCUQwFwT5h9r/l2EI+RK765pGqMFr8Q8RBGC1uihjFghYjqMWCPKEWBxGjxQV/XBTxosVB8UHEFxEHxbJiWbEsqMWCqFgSoWJBxCgWtBhBLd5EjBYX5Am1eBPxRYuDanFDxEGxrFhWHETcVBy0+KHFQVosKhZFxZIIFQsixgMkHkQx2Bn5WgAAAABJRU5ErkJggg==",
        D: "iVBORw0KGgoAAAANSUhEUgAAABkAAAAcCAYAAACUJBTQAAAAo0lEQVR4Ab3BSQ6DQBAEwawW//9yOw8ckMUyrBFc0TMGhQ0tTopYEdTiIRF/0uJhEQsV8bKgFgciFlrsiJgFtVgRcaDFhggVN0UcKB4QsaNQxAtaqPhAsaPFoIgNxQeKDxSziBe0ig8UB1rcVLwsKj5QPKTFhmIh4oIWKyJUDGixomccmDihxaCIWTGoxUUTD4v4E1a0OCliw8QNEQMmBkVc9ANaNVQ5WUYODwAAAABJRU5ErkJggg==",
    G: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAcCAYAAAB/E6/TAAAArklEQVR4Ab3BSY7DMBAEwayG///lnjzoYAiitqEZEW5qMRBxIZxo8VDEgTDQ4qWInbDTYpKITfjSYrIIfXgoYtPiprBpMRBxocVAVKjFQMQNESeKExGTFBNFDKTFgYiJikWKRT681OKmqFigVSxSLFIskhYDEQ+1OFARCxQnWkxSXGhxU4uBsGlxImKgxYXwpcUPRMWXiB8pdiL+IeJAcSDihYiBcKHFhYidFpvoDzxoWD7A9miHAAAAAElFTkSuQmCC",
        N: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAYCAYAAAD6S912AAAAgElEQVR4Aa3ByQ0DMRADwSbh/FMe87lY6BjZqhJ/qOBB8algQMFCBQNmooJDFeYys1DBIXOZ2ajggGmooMlcZgYUvFTQYCYU/MAcqGDDLCh4qWDBXGY2FLxUMGEaFDSZy0yTggZzQMGGucwMVDChYMFcZn6gYEJEBQ8KGip4UHwBgHI8KbOYgd0AAAAASUVORK5CYII=",
    T: "iVBORw0KGgoAAAANSUhEUgAAABMAAAAZCAYAAADTyxWqAAAASElEQVR4Aa3BsQ3AMAzAMFn//5x6LtCgg8g5i59mcTFnEZGQhCQ0XJzFyyw+SEhCEpKQhCQkIQlJSEISkpCEJCQhCUlIQhJ6ABNNDCzU0gypAAAAAElFTkSuQmCC",
        Z: "iVBORw0KGgoAAAANSUhEUgAAABcAAAAcCAYAAACK7SRjAAAAmklEQVR4AbXBQY7FIAxEwdeW739lTy/+YoRIggmp4oT6YZA0lNGQDMo4JMv4SMj4SPCh5IaMiTIGMgaiqYwJGYPgABkTQUMZDcFLMi4Ei8poCl6QcSNYUMaGYJOMB8GDMjaJG2VMyFgQNMlYFFwo46WgQUZDMFHGAckiGTfK+EeWDMq4UEaDGJRxSPCh5DAZP8kmGQ+SBzI2/QF2Ikg+WEOXmgAAAABJRU5ErkJggg==",
            C: "iVBORw0KGgoAAAANSUhEUgAAABUAAAAXCAYAAADk3wSdAAAAkUlEQVR4AbXBQZLDIBAEwer5/59n68BBQYBky0tm2GjxIGIhTFp8KeIiXLR4KWIIQ4sfRSgMLRYiFlosRIVaLERsRGwUGxEvpcVCxAdaTNJiEvGD4oDigOKA4oDigOKAtFiIeNBiElXEPys2WtxosRGGFjeiFjciFC5avBQxhEmLL0VchIUWH4qYhActJhE3/gBiFVAi3dPmuAAAAABJRU5ErkJggg==",
                X: "iVBORw0KGgoAAAANSUhEUgAAABYAAAAbCAYAAAB4Kn/lAAAAtElEQVR4AbXBQRLCQAwEsR7//8+mDxxSW14ISZCCWgwiTmixCG8tBhEftBgUN7TYCActBhGLFhtR8bAIFQcRgxY/KhYRX7QYRLwVJ7VQi0HEQdho8YOIg+IBEYtiI+KG4qaIQfiixUbERvEnxQctLipuaLERNlqcFLEo/qQYtBhEDFosikWLQYQiTige0uIgHLQYRCxaDCJUvLUYRFxQXBQxaKFCLQYRF6XFRsQXLQbhAS0WL6oWcB5KCtuNAAAAAElFTkSuQmCC",
                L: "iVBORw0KGgoAAAANSUhEUgAAABUAAAAcCAYAAACOGPReAAAAXUlEQVR4AbXBMQ7DMBAEsbmB//9lZYuUsY0IWnJW8MMEm6RACuTGCjZJgRMcJgVSIAVSIAVSIAVSIAVSIAVSIA9WsEFigoOkQAou/rSCF8PXCg6RAimQgotNE9z4AGtuFDfUL71OAAAAAElFTkSuQmCC"
};


// Baca gambar PNG
function bacaPNG(buffer) {
    return PNG.sync.read(buffer);
}

function jarakWarna(a, b) {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];

    return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Ambil warna latar dari empat sudut gambar
function deteksiLatar(img) {
    const titik = [
        [0, 0],
        [img.width - 1, 0],
        [0, img.height - 1],
        [img.width - 1, img.height - 1]
    ];

    const warna = titik.map(([x, y]) => {
        const i = (y * img.width + x) * 4;
        return [
            img.data[i],
            img.data[i + 1],
            img.data[i + 2]
        ];
    });

    return [0, 1, 2].map(c =>
        Math.round(warna.reduce((s, w) => s + w[c], 0) / 4)
    );
}

// Segmentasi piksel yang berbeda dari warna latar
function segmentasi(img, latar) {
    const { width, height, data } = img;
    const mask = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;

            if (data[i + 3] === 0) continue;

            const d = jarakWarna(
                [data[i], data[i + 1], data[i + 2]],
                latar
            );

            if (d > AMBANG_WARNA) {
                mask[y * width + x] = 1;
            }
        }
    }

    return mask;
}

// Cari komponen terhubung menggunakan BFS
function cariObjek(mask, width, height) {
    const dikunjungi = new Uint8Array(mask.length);
    const objek = [];

    const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
    const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

    for (let awal = 0; awal < mask.length; awal++) {
        if (!mask[awal] || dikunjungi[awal]) continue;

        const antrean = [awal];
        dikunjungi[awal] = 1;

        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;

        const piksel = [];

        for (let q = 0; q < antrean.length; q++) {
            const pos = antrean[q];
            const x = pos % width;
            const y = Math.floor(pos / width);

            piksel.push(pos);

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);

            for (let n = 0; n < 8; n++) {
                const nx = x + dx[n];
                const ny = y + dy[n];

                if (
                    nx < 0 || nx >= width ||
                    ny < 0 || ny >= height
                ) continue;

                const np = ny * width + nx;

                if (mask[np] && !dikunjungi[np]) {
                    dikunjungi[np] = 1;
                    antrean.push(np);
                }
            }
        }

        if (piksel.length < LUAS_MINIMUM) continue;

        objek.push({
            piksel,
            minX,
            minY,
            maxX,
            maxY,
            luas: piksel.length
        });
    }

    return objek.sort((a, b) => a.minX - b.minX);
}

// Normalisasi bentuk ke kanvas persegi tanpa mengubah rasio
function normalisasi(mask, width, height) {
    const hasil = new Uint8Array(UKURAN * UKURAN);

    const padding = 12;
const area = UKURAN - padding * 2;
    const scale = Math.min(
        area / width,
        area / height
    );

    const nw = Math.max(1, Math.round(width * scale));
    const nh = Math.max(1, Math.round(height * scale));

    const ox = Math.floor((UKURAN - nw) / 2);
    const oy = Math.floor((UKURAN - nh) / 2);

    for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
            const sx = Math.min(
                width - 1,
                Math.floor(x * width / nw)
            );

            const sy = Math.min(
                height - 1,
                Math.floor(y * height / nh)
            );

            if (mask[sy * width + sx]) {
                hasil[(oy + y) * UKURAN + ox + x] = 1;
            }
        }
    }

    return hasil;
}

// Putar mask huruf pada gambar asli,
// lalu normalisasi kembali tanpa mengubah rasio bentuknya.
function rotasiDanNormalisasi(mask, width, height, angle) {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Kanvas persegi cukup besar untuk menampung hasil rotasi.
    const size = Math.ceil(Math.sqrt(
        width * width + height * height
    )) + 4;

    const source = new Uint8Array(size * size);

    const offsetX = Math.floor((size - width) / 2);
    const offsetY = Math.floor((size - height) / 2);

    // Tempatkan mask asli di tengah kanvas.
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (mask[y * width + x]) {
                source[
                    (offsetY + y) * size + offsetX + x
                ] = 1;
            }
        }
    }

    const rotated = new Uint8Array(size * size);
    const center = (size - 1) / 2;

    let minX = size;
    let minY = size;
    let maxX = -1;
    let maxY = -1;

    // Inverse mapping: setiap piksel output mencari
    // posisi piksel sumber yang sesuai.
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - center;
            const dy = y - center;

            const sx = Math.round(
                cos * dx + sin * dy + center
            );

            const sy = Math.round(
                -sin * dx + cos * dy + center
            );

            if (
                sx < 0 || sx >= size ||
                sy < 0 || sy >= size
            ) continue;

            if (source[sy * size + sx]) {
                rotated[y * size + x] = 1;

                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (maxX < minX || maxY < minY) {
        return new Uint8Array(UKURAN * UKURAN);
    }

    // Potong area kosong hasil rotasi.
    const rw = maxX - minX + 1;
    const rh = maxY - minY + 1;
    const crop = new Uint8Array(rw * rh);

    for (let y = 0; y < rh; y++) {
        for (let x = 0; x < rw; x++) {
            crop[y * rw + x] =
                rotated[(minY + y) * size + minX + x];
        }
    }

    return normalisasi(crop, rw, rh);
}

// Buat mask template dari channel alpha.
// Template putih tetap dikenali meskipun warna RGB-nya putih.
function maskTemplate(img) {
    const mask = new Uint8Array(img.width * img.height);

    for (let i = 0; i < mask.length; i++) {
        const p = i * 4;
        mask[i] = img.data[p + 3] > 20 ? 1 : 0;
    }

    return normalisasi(mask, img.width, img.height);
}

// Bandingkan dua mask dengan Intersection over Union
function skorCocok(a, b) {
    let irisan = 0;
    let gabungan = 0;

    for (let i = 0; i < a.length; i++) {
        if (a[i] && b[i]) irisan++;
        if (a[i] || b[i]) gabungan++;
    }

    return gabungan ? irisan / gabungan : 0;
}

function main(inputBuffer = null) {
    if (!inputBuffer && !fs.existsSync(FILE_INPUT)) {
        console.error('File tidak ditemukan:', FILE_INPUT);
        process.exit(1);
    }

    const sumber = bacaPNG(inputBuffer || fs.readFileSync(FILE_INPUT));
    const latar = deteksiLatar(sumber);

    console.log('Ukuran gambar:', sumber.width, 'x', sumber.height);
    console.log('Perkiraan warna latar:', latar);

    const mask = segmentasi(sumber, latar);
    const objek = cariObjek(mask, sumber.width, sumber.height);

    console.log('Objek terdeteksi:', objek.length);

    const templates = {};

    for (const [huruf, base64] of Object.entries(TEMPLATES)) {
        if (base64.startsWith('BASE64_')) {
            console.error(`Template ${huruf} belum diisi Base64.`);
            process.exit(1);
        }

        templates[huruf] = maskTemplate(
            bacaPNG(Buffer.from(base64, 'base64'))
        );
    }

    const hasil = [];

    objek.forEach((obj, index) => {
        const w = obj.maxX - obj.minX + 1;
        const h = obj.maxY - obj.minY + 1;
        const crop = new Uint8Array(w * h);

        for (const pos of obj.piksel) {
            const x = pos % sumber.width;
            const y = Math.floor(pos / sumber.width);

            crop[(y - obj.minY) * w + (x - obj.minX)] = 1;
        }

        const skorTerbaik = {};

// Uji setiap sudut rotasi untuk objek target.
// Template tetap tegak dan tidak perlu diputar.
for (
    let angle = ROTASI_MIN;
    angle <= ROTASI_MAX;
    angle += ROTASI_STEP
) {
    const bentuk = rotasiDanNormalisasi(
        crop,
        w,
        h,
        angle
    );

    for (const [huruf, template] of Object.entries(templates)) {
        const skor = skorCocok(bentuk, template);

        if (
            !skorTerbaik[huruf] ||
            skor > skorTerbaik[huruf].skor
        ) {
            skorTerbaik[huruf] = {
                skor,
                sudut: angle
            };
        }
    }
}

// Urutkan seluruh kandidat berdasarkan skor tertinggi.
const semuaSkor = Object.entries(skorTerbaik)
    .map(([huruf, data]) => ({
        huruf,
        skor: data.skor,
        sudut: data.sudut
    }))
    .sort((a, b) => b.skor - a.skor);

const terbaik = semuaSkor[0] || {
    huruf: '?',
    skor: 0,
    sudut: 0
};

const diterima = terbaik.skor >= AMBANG_COCOK;

// console.log(
    // '  Skor terbaik:',
    // semuaSkor
        // .slice(0, 5)
        // .map(v =>
            // `${v.huruf} ${(v.skor * 100).toFixed(1)}% ` +
            // `(${v.sudut}°)`
        // )
        // .join(' | ')
// );

// console.log(
    // `Objek ${index + 1}: ` +
    // `${diterima ? terbaik.huruf : 'TIDAK DIKENALI'} | ` +
    // `skor ${(terbaik.skor * 100).toFixed(1)}% | ` +
    // `sudut ${terbaik.sudut}° | ` +
    // `posisi (${obj.minX}, ${obj.minY}) | ${w}x${h}`
// );

        hasil.push({
            index: index + 1,
            huruf: diterima ? terbaik.huruf : '?',
            skor: terbaik.skor,
            x: obj.minX,
            y: obj.minY,
            width: w,
            height: h
        });

    });

    const password = hasil.map(h => h.huruf).join('');
    console.log('\n=== HASIL AKHIR ===');
    console.log(password);
    return password;
}

if (require.main === module) main();
module.exports = { solveBuffer: (buffer) => main(buffer) };
