// 获取DOM元素
const hexInput = document.getElementById('hex-input');
const rgbRInput = document.getElementById('rgb-r');
const rgbGInput = document.getElementById('rgb-g');
const rgbBInput = document.getElementById('rgb-b');
const hslHInput = document.getElementById('hsl-h');
const hslSInput = document.getElementById('hsl-s');
const hslLInput = document.getElementById('hsl-l');
const glslRInput = document.getElementById('glsl-r');
const glslGInput = document.getElementById('glsl-g');
const glslBInput = document.getElementById('glsl-b');

// 颜色转换函数
function hexToRgb(hex) {
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b };
}

function rgbToHex(r, g, b) {
    return (
        (1 << 24) + (r << 16) + (g << 8) + b
    ).toString(16).slice(1).toUpperCase();
}

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return { h, s, l };
}

function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToGlsl(r, g, b) {
    return { r: (r / 255), g: (g / 255), b: (b / 255) };
}

function glslToRgb(r, g, b) {
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
// 更新函数
function updateColors(source) {
  let r, g, b, h, s, l, hex, glslR, glslG, glslB;

  if (source === 'hex') {
    let hexValue = hexInput.value.trim();
    if (hexValue.startsWith('0x')) {
      hexValue = hexValue.substring(2);
    } else if (hexValue.startsWith('#')) {
      hexValue = hexValue.substring(1);
    }

    if (/^[0-9A-Fa-f]{6}$/.test(hexValue)) {
      ({ r, g, b } = hexToRgb(hexValue));
      ({ h, s, l } = rgbToHsl(r, g, b));
      ({ r: glslR, g: glslG, b: glslB } = rgbToGlsl(r, g, b));

      rgbRInput.value = r;
      rgbGInput.value = g;
      rgbBInput.value = b;
      hslHInput.value = h;
      hslSInput.value = s;
      hslLInput.value = l;
      glslRInput.value = glslR;
      glslGInput.value = glslG;
      glslBInput.value = glslB;
    }
  } else if (source === 'rgb') {
      r = parseInt(rgbRInput.value);
      g = parseInt(rgbGInput.value);
      b = parseInt(rgbBInput.value);

    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
      hex = rgbToHex(r, g, b);
      ({ h, s, l } = rgbToHsl(r, g, b));
      ({ r: glslR, g: glslG, b: glslB } = rgbToGlsl(r, g, b));

      hexInput.value = hex;
      hslHInput.value = h;
      hslSInput.value = s;
      hslLInput.value = l;
      glslRInput.value = glslR;
      glslGInput.value = glslG;
      glslBInput.value = glslB;
    }
  } else if (source === 'hsl') {
      h = parseInt(hslHInput.value);
      s = parseInt(hslSInput.value);
      l = parseInt(hslLInput.value);

    if (h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100) {
      ({ r, g, b } = hslToRgb(h, s, l));
      hex = rgbToHex(r, g, b);
      ({ r: glslR, g: glslG, b: glslB } = rgbToGlsl(r, g, b));

      hexInput.value = hex;
      rgbRInput.value = r;
      rgbGInput.value = g;
      rgbBInput.value = b;
      glslRInput.value = glslR;
      glslGInput.value = glslG;
      glslBInput.value = glslB;
    }
  } else if (source === 'glsl') {
      glslR = parseFloat(glslRInput.value);
      glslG = parseFloat(glslGInput.value);
      glslB = parseFloat(glslBInput.value);

    if (glslR >= 0 && glslR <= 1 && glslG >= 0 && glslG <= 1 && glslB >= 0 && glslB <= 1) {
      ({ r, g, b } = glslToRgb(glslR, glslG, glslB));
      hex = rgbToHex(r, g, b);
      ({ h, s, l } = rgbToHsl(r, g, b));

      hexInput.value = hex;
      rgbRInput.value = r;
      rgbGInput.value = g;
      rgbBInput.value = b;
      hslHInput.value = h;
      hslSInput.value = s;
      hslLInput.value = l;
    }
  }
}

// 事件监听器
hexInput.addEventListener('input', () => updateColors('hex'));
rgbRInput.addEventListener('input', () => updateColors('rgb'));
rgbGInput.addEventListener('input', () => updateColors('rgb'));
rgbBInput.addEventListener('input', () => updateColors('rgb'));
hslHInput.addEventListener('input', () => updateColors('hsl'));
hslSInput.addEventListener('input', () => updateColors('hsl'));
hslLInput.addEventListener('input', () => updateColors('hsl'));
glslRInput.addEventListener('input', () => updateColors('glsl'));
glslGInput.addEventListener('input', () => updateColors('glsl'));
glslBInput.addEventListener('input', () => updateColors('glsl'));

// 添加键盘事件监听器，支持 Enter 键
const allInputs = document.querySelectorAll('input');
allInputs.forEach(input => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      updateColors(event.target.id.split('-')[0]); // 获取触发事件的输入框类型
    }
  });
});