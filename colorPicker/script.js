// Helper functions for color conversion (RGB <-> HSL)
function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max == min) {
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

    return [h, s, l];
}

function hslToRgb(h, s, l) {
    let r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r,g,b){
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

Vue.component('color-picker', {
    props: ['value'],
    data() {
        return {
            showPanel: false,
            hue: 0, // 0-1
            saturation: 1, // 0-1
            luminosity: 1, // 0-1
            selectedColor: '#ff0000',
        };
    },
    computed: {
        previewColor() {
          return this.selectedColor;
        },
        areaColor() {
            let [r, g, b] = hslToRgb(this.hue, 1, 0.5);
            return `rgb(${r}, ${g}, ${b})`;
        },
        areaIndicatorStyle() {
            return {
                left: `${this.saturation * 100}%`,
                top: `${(1 - this.luminosity) * 100}%`,
            }
        },
        hueIndicatorStyle() {
            return {
                left: `${this.hue * 100}%`,
            }
        },
    },
    watch: {
        value(newVal) {
            this.setColorFromHex(newVal);

        },
    },
    mounted() {
      this.setColorFromHex(this.value || '#ff0000');
    },
    methods: {
        togglePanel() {
            this.showPanel = !this.showPanel;
        },
        handleAreaMouseDown(event) {
            this.updateAreaColor(event);
            const onMouseMove = (event) => {
                this.updateAreaColor(event);
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        },
        updateAreaColor(event) {
            const rect = this.$refs.area.getBoundingClientRect();
            let x = event.clientX - rect.left;
            let y = event.clientY - rect.top;
            x = Math.max(0, Math.min(x, rect.width));
            y = Math.max(0, Math.min(y, rect.height));
            this.saturation = x / rect.width;
            this.luminosity = 1 - (y / rect.height);
            this.updateColor();
        },
        handleHueMouseDown(event) {
            this.updateHue(event);
            const onMouseMove = (event) => {
                this.updateHue(event);
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        },
        updateHue(event) {
            const rect = this.$refs.hueSlider.getBoundingClientRect();
            let y = event.clientY - rect.top;
            y = Math.max(0, Math.min(y, rect.height));
            this.hue = 1 - (y / rect.height);
            this.updateColor();
        },
      computed: {
        previewColor() {
          return this.selectedColor;
        },
        areaColor() {
            let [r, g, b] = hslToRgb(this.hue, 1, 0.5);
            return `rgb(${r}, ${g}, ${b})`;
        },
        areaIndicatorStyle() {
            return {
                left: `${this.saturation * 100}%`,
                top: `${(1 - this.luminosity) * 100}%`,
            }
        },
        hueIndicatorStyle() {
            return {
                top: `${(1-this.hue) * 100}%`,
            }
        },
    },
        updateColor() {
            const [r, g, b] = hslToRgb(this.hue, this.saturation, this.luminosity);
            this.selectedColor = rgbToHex(r,g,b);
        },
        setColorFromHex(hex) {
          try{
            hex = hex.replace(/^#/, '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            if(isNaN(r) || isNaN(g) || isNaN(b)) return;
            const [h, s, l] = rgbToHsl(r, g, b);
            this.hue = h;
            this.saturation = s;
            this.luminosity = l;
            this.selectedColor = '#' + hex;
          }catch(e){
            console.error("Invalid hex color:", hex, e);
          }
        },
        confirmColor() {
            this.$emit('input', this.selectedColor);
            this.showPanel = false;
        },
        clearColor() {
            this.$emit('input', ''); // Or a default color
            this.showPanel = false;
             this.setColorFromHex('#ff0000');
        },
        handleInputChange(){
          this.setColorFromHex(this.selectedColor);
        }
    },
    template: `
        <div class="color-picker">
            <div class="color-picker__preview" :style="{ backgroundColor: previewColor }" @click="togglePanel">
                <div class="color-picker__dropdown-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </div>
            <div class="color-picker__panel" :class="{ show: showPanel }">
              <div class="color-picker__panel-content">
                <div class="color-picker__area" :style="{ backgroundColor: areaColor }" @mousedown="handleAreaMouseDown" ref="area">
                  <div class="color-picker__area-indicator" :style="areaIndicatorStyle"></div>
                </div>
                <div class="color-picker__hue-slider" @mousedown="handleHueMouseDown" ref="hueSlider">
                    <div class="color-picker__hue-indicator" :style="hueIndicatorStyle"></div>
                </div>
              </div>
            <div class="color-picker__controls">
                <input type="text" class="color-picker__input" v-model="selectedColor" @change="handleInputChange">
                <div class="color-picker__buttons">
                    <button @click="clearColor">清空</button>
                    <button @click="confirmColor">确定</button>
                </div>
            </div>

        </div>
    `,
});