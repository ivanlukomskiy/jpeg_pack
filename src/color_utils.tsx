
const DEFAULT_STOPS: Array<{ t: number; r: number; g: number; b: number }> = [
    { t: 0.00, r:  33, g:  64, b: 154 }, // deep blue
    { t: 0.25, r:  30, g: 144, b: 223 }, // sky
    { t: 0.50, r: 120, g: 205, b:  85 }, // green
    { t: 0.75, r: 255, g: 230, b:  80 }, // yellow
    { t: 1.00, r: 234, g:  57, b:  49 }, // red
];

export type Color = { r: number; g: number; b: number; a?: number };

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

function clamp01(x: number) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function getColor(
    val: number,
    min: number,
    max: number,
    stops: typeof DEFAULT_STOPS = DEFAULT_STOPS
): Color {
    if (!Number.isFinite(val) || !Number.isFinite(min) || !Number.isFinite(max)) {
        return { r: 128, g: 128, b: 128, a: 255 }; // fallback gray
    }

    // Normalize to [0,1]
    let t: number;
    if (max === min) {
        t = 0.5;
    } else {
        t = clamp01((val - min) / (max - min));
    }

    // Find the two stops surrounding t
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i];
        const b = stops[i + 1];
        if (t >= a.t && t <= b.t) {
            lo = a; hi = b;
            break;
        }
    }

    // Local interpolation factor between lo..hi
    const span = hi.t - lo.t || 1;
    const lt = clamp01((t - lo.t) / span);

    const r = Math.round(lerp(lo.r, hi.r, lt));
    const g = Math.round(lerp(lo.g, hi.g, lt));
    const b = Math.round(lerp(lo.b, hi.b, lt));
    return { r, g, b, a: 255 };
}

export function getColorCss(val: number, min: number, max: number): string {
    const { r, g, b } = getColor(val, min, max);
    return `rgb(${r} ${g} ${b})`;
}

function getTextColor(bg: { r: number; g: number; b: number }): string {
    // Convert to relative luminance (https://www.w3.org/TR/WCAG20/#relativeluminancedef)
    const [r, g, b] = [bg.r, bg.g, bg.b].map(v => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Pick white for dark backgrounds, black for light ones
    return luminance > 0.179 ? '#000000' : '#ffffff';
}

export function getTextColor2(value: string): string {
    const float = parseFloat(value, 10);
    if (float <= 0) {
        return 'red'
    }
    return getTextColor(getColor(float, 0, 1))
}