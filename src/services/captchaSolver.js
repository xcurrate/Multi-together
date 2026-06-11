const { PNG } = require("pngjs");
//const fetch = require('node-fetch');
const log = require('../../logger');

// Template database (base64 encoded images)
const TEMPLATES = {
        A: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAARElEQVQoFWN0mv3/PwOJgIlE9WDlZGliJNYmZG+QZxOyCcTaSpZNZGliQXbSvlRGnAGD7A2ybGJENgHZVnxssmwiSxMARF4PhclsgWMAAAAASUVORK5CYII=",
    B: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAASCAYAAACAa1QyAAAAO0lEQVQoFWN0mv3/PwMU7EtlZISx8dFM+CRxyQ1yTYzIAYHLD+ji9PMTC7LV+OIJ2Rv0c95wtGmQpwgAPGAN2uSjSi0AAAAASUVORK5CYII=",
    C: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAALklEQVQoFWN0mv3/PwOJgIlE9WDlZGliQbZpXyojIzIfF5ssm0Y1QYOTcXCnCADdtQb2r0ES3wAAAABJRU5ErkJggg==",
    D: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAASCAYAAACAa1QyAAAAOUlEQVQoFWNkIBI4zf7/H6aUCcYghR7kmhiRPUisv+jnJxZkJ+1LZWRE5iOzkb1BP+cNR5sGeYoAAJVGDLX7Igd2AAAAAElFTkSuQmCC",
    E: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAP0lEQVQoFWN0mv3/PwOJgIlE9WDlZGliQbZpXyojIzIfmY3sDbJsYkQ2AdlkfGyybCJLE9EBgexcsmwa5AEBAB/ZDdI5nuFXAAAAAElFTkSuQmCC",
    F: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAMUlEQVQoFWN0mv3/PwOJgIlE9WDlZGliQbZpXyojIzIfF5ssmxhHAwISnmSFHv00AQDzrwgdUIeJDgAAAABJRU5ErkJggg==",
    G: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAR0lEQVQoFWN0mv3/PwOJgIlE9WDlZGliQbZpXyojIzIfF5tym2AmEwocsmwiSxNKQMCchy1AkJ1Mlk2MyCbAbCJEk2UTWZoA7Z4N1XlVX20AAAAASUVORK5CYII=",
    H: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAASCAYAAACAa1QyAAAAPUlEQVQoFWN0mv3/PwMU7EtlZISx8dFM+CRxyQ1yTYzIAYHLD+ji9PMTC7LV+OIJ2Rv0c96oTdD4oV9AAAB/TQsAYy1MLwAAAABJRU5ErkJggg==",
    I: "iVBORw0KGgoAAAANSUhEUgAAAAkAAAANCAYAAAB7AEQGAAAAIklEQVQYGWNkQAJOs///h3H3pTIywthMMAY+elQRw2AMAgBW+wQa/q56owAAAABJRU5ErkJggg==",
    J: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAN0lEQVQoFWNkIBI4zf7/H6aUCcYghR7VBA0tsgKCBTn896UyMhIT9GTZxIhsEzG2gNSQZRNZmgAmfgnRpvfItgAAAABJRU5ErkJggg==",
    K: "iVBORw0KGgoAAAANSUhEUgAAAAwAAAANCAYAAACdKY9CAAAAaklEQVQoFYWR0Q3AIAhES0frLp2qu3Q1zSW95rhA8EeU94BoXM9ax7feO4Kx7+ROT1RnwsiNgsKj4DBGbjtUcNuhg0vBYUC60kgTDDEJWkljLVQKeA3/RErBgBU7kPnUwWFAfvcLnmBFlzY0ejHPkHfW8AAAAABJRU5ErkJggg==",
    L: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAL0lEQVQoFWN0mv3/PwMU7EtlZISx8dFM+CRxyY1qgobMIA8IRuQUgSsy0cXp5ycAj5sG9B8JGsEAAAAASUVORK5CYII=",
    M: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAMElEQVQoFWN0mv3/PwOJgIlE9WDllGval8rICMLItmMTo9wmZBvwsUdtgoYO/QICANPkB4nFxDDlAAAAAElFTkSuQmCC",
    N: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAL0lEQVQoFWN0mv3/PwOJgIlE9WDlZGliQbZpXyojIzIfmY3sDbJsGtUEDc5BHhAAj7kG91sA1sEAAAAASUVORK5CYII=",
    O: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAN0lEQVQoFWN0mv3/PwOJgIlE9WDlZGliQbZpXyojIzIfmY3sDbJsGtUEDU5G5KBEDmJ8bPqFHgBMzAnR80GexgAAAABJRU5ErkJggg==",
    P: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAASCAYAAACAa1QyAAAAQklEQVQoFWN0mv3/PwOJgIlE9WDlZGliQbZpXyojIzIfmY3sDbJsGtUEDU5G5KBEDmJ8bPqFHtEpAtm59HMe/WwCAJ8UCwJWTpYsAAAAAElFTkSuQmCC",
    Q: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAASCAYAAACAa1QyAAAATUlEQVQoFWN0mv3/PwOJgIlE9WDlZGliQbZpXyojIzIfmY3sDbJsGtUEDU5G5KBEDmJ8bPqFHtYUgOxkbKmELOcRtAkWIMg2kmUTWZoAQwMR2VhDl78AAAAASUVORK5CYII=",
    R: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAALUlEQVQoFWN0mv3/PwOJgIlE9WDlZGliQbZpXyojIzIfF5ssm0Y1QYNzkAcEACCxBBxWW3qwAAAAAElFTkSuQmCC",
    S: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAANElEQVQoFWN0mv3/PwOJgIlE9WDlZGliQbZpXyojIzIfF5ssmxgHd0AQ5XFQgCB7YzgGBAAHzQyqIIdwIAAAAABJRU5ErkJggg==",
    T: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAALUlEQVQoFWN0mv3/PwOJgIlE9WDlZGlixGYTspP3pTJiqCHLplFN0KAe5AEBAKu7BvTrMd81AAAAAElFTkSuQmCC",
    U: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAMUlEQVQoFWN0mv3/PwMU7EtlZISx0WlkdUzoksTwRzVBQ2mQBwQjckwTE7EgNfTzEwDExgnPrPJ4NwAAAABJRU5ErkJggg==",
    V: "iVBORw0KGgoAAAANSUhEUgAAAAwAAAANCAYAAACdKY9CAAAAd0lEQVQoFYWQAQ6AIAwDGfFl/sVX+Re+htSkpBssLDE09tqhpYy5397xQGdD3ygAtsdsF1CmKqCGvldds1ZCWgLWbQCkgGoW/IHTFsBkLib13DXTd38lA9mO0PINbMpOtwFQ3KLt8JcNEQCkswTUPIUnG681jSE+XwMvgvKD3yEAAAAASUVORK5CYII=",
    W: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAALUlEQVQoFWN0mv3/PwMU7EtlZAQxCYkxwTSQQo9qgobWIA8IRuTYJzaC6ecnACGvDc/Z7HB/AAAAAElFTkSuQmCC",
    X: "iVBORw0KGgoAAAANSUhEUgAAAAwAAAANCAYAAACdKY9CAAAAgklEQVQoFZWSiw2AIAxEi6PpKm6lqzgbesRnygVNJMGW3gcaG7XWmLfre8WvDacoiXsdaxTyHJc9Hs70BlDPZNUmd82EnGPQbnARoEfxihpljRzBMO0EAl0EEeH/plG6M3XFjLUbcgGiPwVO9+NGZIhgXQ8qurOf2/xoPJiVt3kCPwGLgnhJFhDySgAAAABJRU5ErkJggg==",
    Y: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAASCAYAAACAa1QyAAAAPklEQVQoFWN0mv3/PwMU7EtlZISx0WlkdUzoksTwRzVBQ2mQBwQjckwTE7EgNfTzE9YEiuxkbImYfs6jn00ArlAN2LER5EoAAAAASUVORK5CYII=",
    Z: "iVBORw0KGgoAAAANSUhEUgAAAA0AAAANCAYAAABy6+R8AAAAT0lEQVQoFWN0mv3/PwOJgIlE9WDlZGliJGQTuvP3pTIy4tWETQPIEpyacGnAqQmfBqyaCGnA0ESMBhRNxGqAa0LXAJLABxhJ1QAyjKwUAQA6fySifLwVygAAAABJRU5ErkJggg==",
    // A: "...", B: "...", ...
  };
// Priority groups for template matching
const PRIORITY_GROUPS = [
    [..."ABDEGKMPQSTVWXYZ"],
    [..."FHO"],
    [..."CNRU"],
    [..."JL"],
    [..."I"],
];

// ---------- decode base64 template -> PNG ----------
function decodeBase64ToPng(b64) {
    const buf = Buffer.from(b64, "base64");
    return PNG.sync.read(buf);
}

// ---------- download image url -> PNG ----------
async function fetchPng(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("image")) throw new Error(`Not an image content-type: ${ct}`);
    const ab = await res.arrayBuffer();
    return PNG.sync.read(Buffer.from(ab));
}

// ---------- build alpha mask indices ----------
function buildMaskIndices(png) {
    const { width: w, height: h, data } = png;
    const idxs = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const a = data[i + 3];
            if (a > 0) idxs.push(i);
        }
    }
    return idxs;
}

// ---------- compare a template at (x,y) in large image using mask ----------
function segmentEqualsMasked(large, small, x, y, maskPixelIdxs) {
    const lw = large.width;
    const sw = small.width;
    const largeData = large.data;
    const smallData = small.data;

    for (let k = 0; k < maskPixelIdxs.length; k++) {
        const si = maskPixelIdxs[k];
        const p = (si / 4) | 0;
        const sx = p % sw;
        const sy = (p / sw) | 0;

        const li = ((y + sy) * lw + (x + sx)) * 4;

        if (
            largeData[li] !== smallData[si] ||
            largeData[li + 1] !== smallData[si + 1] ||
            largeData[li + 2] !== smallData[si + 2] ||
            largeData[li + 3] !== smallData[si + 3]
        ) {
            return false;
        }
    }
    return true;
}

// ---------- prevent near-duplicate matches ----------
function isTooClose(matches, x, y, sw, sh) {
    for (const m of matches) {
        if (
            x > m.x - sw && x < m.x + sw &&
            y > m.y - sh && y < m.y + sh
        ) return true;
    }
    return false;
}

// ---------- main solver ----------
async function solveCaptcha(imageUrl) {
    try {
        // Prepare templates
        const checks = [];
        for (const group of PRIORITY_GROUPS) {
            for (const key of group) {
                const tpl = decodeBase64ToPng(TEMPLATES[key]);
                const maskIdxs = buildMaskIndices(tpl);
                checks.push({
                    key,
                    tpl,
                    maskIdxs,
                    w: tpl.width,
                    h: tpl.height
                });
            }
        }

        // Fetch large image
        const large = await fetchPng(imageUrl);
        const matches = [];

        // Template matching
        for (const item of checks) {
            const { tpl, maskIdxs, w: sw, h: sh, key } = item;

            for (let y = 0; y <= large.height - sh; y++) {
                for (let x = 0; x <= large.width - sw; x++) {
                    if (segmentEqualsMasked(large, tpl, x, y, maskIdxs)) {
                        if (!isTooClose(matches, x, y, sw, sh)) {
                            matches.push({ x, y, key });
                        }
                    }
                }
            }
        }

        // Sort left-to-right and return
        matches.sort((a, b) => a.x - b.x);
        return matches.map(m => m.key).join("");
        
    } catch (error) {
        log.error(`Captcha solver error: ${error.message}`);
        return null;
    }
}

module.exports = {
    solve: solveCaptcha
};