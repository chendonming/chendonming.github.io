## PBR BRDF 实现原理和逻辑

### 什么是 PBR 和 BRDF？

在我们深入 BRDF 之前，先简单理解一下它所处的环境——**PBR（Physically Based Rendering, 基于物理的渲染）**。

*   **PBR 的目标：** 尽可能模拟真实世界中光线与物体表面材质互动的方式，从而创造出更逼真、更可信的视觉效果。它不仅仅是为了“看起来好看”，更是追求在不同光照条件下都能表现一致且符合物理规律的“看起来真实”。

*   **BRDF 的角色：** 在 PBR 的宏伟蓝图中，**BRDF（Bidirectional Reflectance Distribution Function, 双向反射分布函数）** 是实现其目标的核心数学模型之一。它专门负责描述光线照射到**不透明**物体表面时，是如何被**反射**出去的。

### 1. 核心原理 (Why & How)

#### a. 它是什么？解决了什么具体问题？

*   **是什么：** BRDF 是一个函数。简单来说，你可以把它想象成一个“规则手册”，它精确地告诉我们：当一束光以某个特定方向（入射光方向 `L`）照射到物体表面的一个点上时，会有多少能量以另一个特定方向（观察方向 `V`）反射出去。这个“规则”取决于表面本身的材质属性（比如粗糙度、金属度等）以及入射光和观察方向。

*   **解决的问题：** 在没有 PBR 和精确 BRDF 之前，渲染模型（如经典的 Lambertian 或 Phong 模型）通常是基于经验观察或简化假设，它们很难准确模拟各种不同材质的外观。
    *   **遇到的麻烦举例：**
        1.  **材质区分度差：** 使用旧模型，金属、塑料、木材、布料等材质可能看起来都差不多“亮”或“暗”，缺乏独特的质感。例如，一个金属球和一个塑料球可能只有颜色和一点模糊高光的区别，金属强烈的镜面反射和边缘亮度（菲涅尔效应）很难表现。
        2.  **光照依赖性差：** 同一个物体在不同光照环境下（比如从室内柔和灯光拿到室外强烈阳光下）可能看起来完全不自然，需要手动调整大量参数才能“看起来还行”。
        3.  **缺乏能量守恒：** 旧模型有时可能反射出比入射光更多的能量，或者能量损失不符合物理规律，导致画面失真。

    *   **BRDF 的贡献：** PBR BRDF 通过引入基于物理的参数和更复杂的数学模型，能够更准确地模拟光线与微观表面的交互，从而：
        1.  **区分不同材质：** 能表现出金属的强反射、塑料的柔和高光、木材的漫反射纹理等。
        2.  **光照一致性：** 基于物理的模型使得材质在不同光照下表现更稳定、更可预测。
        3.  **能量守恒：** 这是 PBR 的基本原则，BRDF 模型必须确保反射的总能量不会超过入射的总能量。

#### b. 基本工作原理与关键概念

现代 PBR 中最常用的 BRDF 模型是基于**微表面理论 (Microfacet Theory)** 的。这个理论假设：

*   宏观上看起来平坦的表面，在微观尺度上是由大量微小的、朝向各异的**微表面 (Microfacets)** 组成的。
*   每个微表面本身被认为是完美光滑的镜面。
*   表面的整体反射特性，是由这些微表面的集体行为决定的。

基于微表面理论的 BRDF 通常将反射分为两个主要部分：

1.  **漫反射 (Diffuse Reflection)：**
    *   光线进入物体表面内部，经过多次散射后，再从表面随机方向射出。
    *   想象一下光照到粉笔或毛糙木头上的效果。
    *   对于非金属材质，漫反射通常带有材质本身的颜色（吸收了某些波长的光）。
    *   金属材质几乎没有漫反射（光线要么被反射，要么被吸收转化为热能）。
    *   常用的漫反射模型是 **Lambertian**（最简单，假设光向所有方向均匀散射）或更高级的如 **Oren-Nayar**（考虑了表面粗糙度对漫反射的影响）。

2.  **镜面反射 (Specular Reflection)：**
    *   光线在物体表面（或微表面）发生类似镜面的反射。
    *   想象一下光照到镜子、光滑金属或水面上的高光。
    *   镜面反射的强度和方向性与表面的**粗糙度 (Roughness)** 密切相关。
        *   **光滑表面 (Roughness ≈ 0)：** 微表面朝向基本一致，光线被集中反射，形成清晰、锐利的高光。
        *   **粗糙表面 (Roughness ≈ 1)：** 微表面朝向混乱，光线被散射到更广阔的方向，形成模糊、宽广的高光。
    *   常用的镜面反射模型是 **Cook-Torrance BRDF**，它包含三个关键部分：
        *   **D - 法线分布函数 (Normal Distribution Function, NDF):** 描述微表面的朝向分布。即，有多少微表面的法线正好指向能将光线 `L` 反射到观察方向 `V` 的那个“半角向量 `H`”方向。粗糙度越高，分布越广。常用模型有 GGX (Trowbridge-Reitz)、Beckmann 等。
        *   **G - 几何遮挡函数 (Geometry Function / Shadowing-Masking Function):** 描述微表面之间的自遮挡效应。一些微表面可能会被其他微表面遮挡（对入射光 Shadowing 或对出射光 Masking）。粗糙表面遮挡更明显。常用模型有 Smith (结合了 GGX 或 Beckmann)。
        *   **F - 菲涅尔方程 (Fresnel Equation):** 描述在不同入射角度下，光线被反射的比例 vs 被折射（进入物体内部）的比例。
            *   一个关键现象是：对于**所有**材质（包括非金属），当视线以掠射角度（接近 90 度角）看向表面时，其反射率都会显著增加。这就是为什么你看向远处的水面或光滑桌面边缘时会觉得特别亮。
            *   菲涅尔项通常使用 **Schlick 近似** 来简化计算。它需要一个基础反射率 `F0`（光线垂直入射时的反射率）。`F0` 对于金属材质通常是其颜色值，对于非金属（电介质）则是一个较小的灰度值（约 0.04）。

    *   **Cook-Torrance 镜面 BRDF 公式（概念性）：**
        ```
        Specular BRDF = (D * G * F) / (4 * (N · L) * (N · V))
        ```
        *   `N` 是宏观表面法线。
        *   `L` 是指向光源的向量。
        *   `V` 是指向观察者的向量。
        *   `(N · L)` 和 `(N · V)` 是点积，代表角度的余弦。分母中的这些项是校正因子。

**最终的 BRDF：**
通常是将漫反射部分和镜面反射部分结合起来。对于金属材质，漫反射项几乎为 0；对于非金属材质，两者都需要计算。为了保证能量守恒，通常会用菲涅尔项来调整漫反射和镜面反射的比例：被镜面反射的部分能量，就不应该再参与漫反射了。

```
Total BRDF = k_diffuse * Diffuse_BRDF + k_specular * Specular_BRDF
```
其中 `k_diffuse` 和 `k_specular` 是能量守恒系数，通常与菲涅尔值 `F` 相关。一个常见的做法是 `k_specular = F`，`k_diffuse = (1 - F) * (1 - metallic)`（这里的 `metallic` 是一个 0 到 1 的参数，表示材质的金属性）。

#### c. 设计思想与权衡

*   **物理准确性 vs 计算成本：** PBR BRDF 的设计目标是更接近物理现实。微表面理论提供了一个很好的框架。但完全模拟光的物理行为极其复杂。Cook-Torrance 等模型是在准确性和实时计算性能之间取得良好平衡的近似模型。更复杂的模型可能更准确，但计算量也更大，不适合实时渲染（如游戏）。
*   **参数化与易用性：** PBR 使用如 `BaseColor`（基础颜色）、`Metallic`（金属度）、`Roughness`（粗糙度）等直观参数。艺术家可以更容易地创作材质，而这些参数又能映射到 BRDF 模型所需的物理属性（如 `F0`、影响 NDF 的粗糙度值等）。这比旧模型中调整各种非物理的 `shininess` 等参数要方便和可靠得多。
*   **模块化：** 将 BRDF 分解为 NDF、G、F 等部分，使得研究人员可以独立改进或替换其中某个部分，推动领域发展。例如，从 Blinn-Phong 的 NDF 发展到更先进的 Beckmann，再到目前广泛使用的 GGX。

### 2. 具体例子 (Concrete Examples)

要在 HTML/JS 环境中完整演示一个 PBR BRDF 渲染循环是相当复杂的，因为它需要 WebGL 来进行 GPU 加速的图形渲染，涉及到 Shader 编程 (GLSL)、缓冲区管理、矩阵变换等。

不过，我们可以做两件事：

1.  展示一个 **概念性的 GLSL (OpenGL Shading Language) 函数片段**，模拟在 GPU 上计算 BRDF 的核心逻辑。
2.  提供一个 **简化的 JavaScript 示例**，计算 BRDF 中的一个关键部分——**菲涅尔效应 (Fresnel Schlick Approximation)**，让你能直观地看到输入如何影响输出。

#### a. 示例 1: 概念性 GLSL BRDF 函数片段

这个例子展示了在片段着色器 (Fragment Shader) 中计算光照的核心逻辑，结合了漫反射和 Cook-Torrance 镜面反射。假设我们已经有了必要的输入变量。

```glsl
// --- 输入变量 (通常由顶点着色器传入或作为 uniform 变量提供) ---
vec3 N;         // 表面法线 (World Space)
vec3 V;         // 观察方向 (从表面指向摄像机, World Space)
vec3 L;         // 光源方向 (从表面指向光源, World Space)
vec3 lightColor;// 光源颜色/强度
vec3 baseColor; // 材质基础颜色 (Albedo)
float metallic; // 材质金属度 (0 = 非金属, 1 = 金属)
float roughness;// 材质粗糙度 (0 = 光滑, 1 = 粗糙)
float ao;       // 环境光遮蔽 (Ambient Occlusion)

// --- 中间计算 ---
vec3 H = normalize(V + L); // 半角向量 (Halfway Vector)
float NdotV = max(dot(N, V), 0.0);
float NdotL = max(dot(N, L), 0.0);
float NdotH = max(dot(N, H), 0.0);
float VdotH = max(dot(V, H), 0.0);

// --- 材质属性计算 ---
vec3 F0 = vec3(0.04); // 非金属的基础反射率 (近似值)
F0 = mix(F0, baseColor, metallic); // 如果是金属，F0 使用基础颜色

// --- 1. 镜面反射部分 (Cook-Torrance BRDF) ---

// D - 法线分布函数 (GGX)
float D_GGX(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float denom = (NdotH * NdotH * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return a2 / denom;
}

// G - 几何遮挡函数 (Smith's method with Schlick-GGX)
float G_SchlickGGX(float NdotV_or_L, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0; // Direct light (k_direct)
    // float k = (roughness * roughness) / 2.0; // IBL (k_IBL)
    float denom = NdotV_or_L * (1.0 - k) + k;
    return NdotV_or_L / denom;
}

float G_Smith(float NdotV, float NdotL, float roughness) {
    float ggxV = G_SchlickGGX(NdotV, roughness);
    float ggxL = G_SchlickGGX(NdotL, roughness);
    return ggxV * ggxL;
}

// F - 菲涅尔方程 (Schlick Approximation)
vec3 F_Schlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// 计算 Cook-Torrance 的三个组件
float NDF = D_GGX(NdotH, roughness);
float G   = G_Smith(NdotV, NdotL, roughness);
vec3  F   = F_Schlick(VdotH, F0); // 使用 VdotH 作为 Schlick 的 cosTheta

// 计算镜面 BRDF (注意分母的校正项)
vec3 numerator    = NDF * G * F;
float denominator = 4.0 * NdotV * NdotL + 0.001; // 加一点防止除零
vec3 specular     = numerator / denominator;

// --- 2. 漫反射部分 (Lambertian + 能量守恒) ---

vec3 kS = F; // 镜面反射的能量比例由菲涅尔决定
vec3 kD = vec3(1.0) - kS; // 剩余能量用于漫反射
kD *= (1.0 - metallic); // 金属没有漫反射

vec3 diffuse = kD * baseColor / PI; // Lambertian BRDF (除以 PI 是为了能量归一化)

// --- 最终光照计算 ---
// Lo = (kD * baseColor / PI + specular) * radiance * NdotL
// Lo = (diffuse + specular) * lightColor * NdotL; // radiance = lightColor

vec3 finalColor = (diffuse + specular) * lightColor * NdotL;

// (通常还会加上环境光/IBL等，这里只显示直接光照)
// finalColor = finalColor + ambientContribution * ao;
```

**代码解释：**

1.  **输入:** 获取法线 `N`, 视线 `V`, 光线 `L`, 以及材质参数 `baseColor`, `metallic`, `roughness`。
2.  **中间向量:** 计算半角向量 `H` 和各种点积 (`NdotV`, `NdotL`, `NdotH`, `VdotH`)，这些是后续计算的基础。
3.  **F0 计算:** 根据 `metallic` 属性确定基础反射率 `F0`。非金属固定为约 0.04，金属使用 `baseColor`。
4.  **镜面部分:**
    *   调用 `D_GGX`, `G_Smith`, `F_Schlick` 函数计算 NDF, G, F 三个组件。
    *   注意 `F_Schlick` 使用 `VdotH` (视线与半角向量的夹角余弦) 作为输入。
    *   根据 Cook-Torrance 公式组合这三者，并除以分母 `4 * NdotV * NdotL` 进行归一化。
5.  **漫反射部分:**
    *   使用菲涅尔值 `F` (即 `kS`) 来确定有多少能量被镜面反射了。
    *   剩余的能量 `kD = 1.0 - kS` 用于漫反射。
    *   如果材质是金属 (`metallic = 1`)，`kD` 会乘以 0，消除漫反射。
    *   使用 `baseColor` 给漫反射上色，并除以 `PI` (Lambertian 模型的归一化因子)。
6.  **最终颜色:** 将漫反射和镜面反射贡献加起来，乘以入射光颜色 `lightColor` 和 `NdotL` (光线入射角度的余弦，表示表面接收到的光量)。

**对比 (PBR BRDF vs Simple Lambertian):**

*   **Simple Lambertian:** 只会计算 `vec3 diffuseColor = baseColor / PI; vec3 finalColor = diffuseColor * lightColor * NdotL;`。结果是颜色均匀、没有高光的表面，无法区分金属和非金属，也无法表现粗糙度变化带来的光泽差异。
*   **PBR BRDF:** 通过复杂的镜面项和基于物理的参数，能产生随视角变化的高光、表现不同粗糙度的模糊效果、体现金属的强反射和菲涅尔效应，效果远比 Lambertian 真实。

#### b. 示例 2: JavaScript 计算菲涅尔效应 (Schlick Approximation)

这个例子让你可以在浏览器中互动地看到菲涅尔效应。

```html
<!DOCTYPE html>
<html>
<head>
<title>PBR Fresnel Schlick Demo</title>
<style>
  body { font-family: sans-serif; padding: 20px; }
  label { display: inline-block; width: 150px; }
  input[type="range"] { width: 200px; }
  #output { margin-top: 20px; font-weight: bold; }
  .color-box { display: inline-block; width: 20px; height: 20px; border: 1px solid #ccc; vertical-align: middle; margin-left: 10px;}
</style>
</head>
<body>

<h1>PBR BRDF - Fresnel Schlick Approximation Demo</h1>

<div>
  <label for="f0_r">Base Reflectivity (F0) Red:</label>
  <input type="range" id="f0_r" min="0" max="1" step="0.01" value="0.04">
  <span id="f0_r_value">0.04</span>
</div>
<div>
  <label for="f0_g">Base Reflectivity (F0) Green:</label>
  <input type="range" id="f0_g" min="0" max="1" step="0.01" value="0.04">
  <span id="f0_g_value">0.04</span>
</div>
<div>
  <label for="f0_b">Base Reflectivity (F0) Blue:</label>
  <input type="range" id="f0_b" min="0" max="1" step="0.01" value="0.04">
  <span id="f0_b_value">0.04</span>
</div>
<div>
  <label for="cosTheta">Angle (cosTheta):</label>
  <input type="range" id="cosTheta" min="0" max="1" step="0.01" value="1.0">
  <span id="cosTheta_value">1.0</span> (0° = 1.0, 90° = 0.0)
</div>

<div id="output">
  Fresnel Reflectance (F): R=<span id="result_r">?</span> G=<span id="result_g">?</span> B=<span id="result_b">?</span>
  <span id="result_color" class="color-box"></span>
</div>

<script>
  const f0_r_slider = document.getElementById('f0_r');
  const f0_g_slider = document.getElementById('f0_g');
  const f0_b_slider = document.getElementById('f0_b');
  const cosTheta_slider = document.getElementById('cosTheta');

  const f0_r_value_span = document.getElementById('f0_r_value');
  const f0_g_value_span = document.getElementById('f0_g_value');
  const f0_b_value_span = document.getElementById('f0_b_value');
  const cosTheta_value_span = document.getElementById('cosTheta_value');

  const result_r_span = document.getElementById('result_r');
  const result_g_span = document.getElementById('result_g');
  const result_b_span = document.getElementById('result_b');
  const result_color_box = document.getElementById('result_color');

  function calculateFresnelSchlick(F0_vec3, cosTheta) {
    // F = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0)
    const oneMinusCos = 1.0 - Math.max(0.0, Math.min(1.0, cosTheta)); // Clamp cosTheta just in case
    const powerOf5 = Math.pow(oneMinusCos, 5.0);

    const F_r = F0_vec3[0] + (1.0 - F0_vec3[0]) * powerOf5;
    const F_g = F0_vec3[1] + (1.0 - F0_vec3[1]) * powerOf5;
    const F_b = F0_vec3[2] + (1.0 - F0_vec3[2]) * powerOf5;

    return [F_r, F_g, F_b];
  }

  function update() {
    const f0_r = parseFloat(f0_r_slider.value);
    const f0_g = parseFloat(f0_g_slider.value);
    const f0_b = parseFloat(f0_b_slider.value);
    const cosTheta = parseFloat(cosTheta_slider.value);

    f0_r_value_span.textContent = f0_r.toFixed(2);
    f0_g_value_span.textContent = f0_g.toFixed(2);
    f0_b_value_span.textContent = f0_b.toFixed(2);
    cosTheta_value_span.textContent = cosTheta.toFixed(2);

    const F0 = [f0_r, f0_g, f0_b];
    const F = calculateFresnelSchlick(F0, cosTheta);

    result_r_span.textContent = F[0].toFixed(3);
    result_g_span.textContent = F[1].toFixed(3);
    result_b_span.textContent = F[2].toFixed(3);

    // Update color box (approximate visualization)
    const r = Math.floor(F[0] * 255);
    const g = Math.floor(F[1] * 255);
    const b = Math.floor(F[2] * 255);
    result_color_box.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
  }

  f0_r_slider.addEventListener('input', update);
  f0_g_slider.addEventListener('input', update);
  f0_b_slider.addEventListener('input', update);
  cosTheta_slider.addEventListener('input', update);

  // Initial calculation
  update();
</script>

</body>
</html>
```

**代码解释与如何使用：**

1.  **HTML:** 设置了几个滑块 (range input) 来控制 `F0` 的 R, G, B 分量和 `cosTheta` (角度余弦)。`cosTheta = 1.0` 代表垂直入射 (0度角)，`cosTheta = 0.0` 代表掠射入射 (90度角)。
2.  **JavaScript:**
    *   `calculateFresnelSchlick` 函数实现了菲涅尔 Schlick 近似公式。它接收一个包含 R, G, B 的 `F0` 数组和一个 `cosTheta` 值。
    *   `update` 函数读取滑块的值，调用 `calculateFresnelSchlick`，然后将计算出的菲涅尔反射率 `F` (也是一个 R, G, B 数组) 显示在页面上，并用一个色块大致可视化这个颜色。
    *   事件监听器确保每次拖动滑块时都会重新计算并更新显示。

**实验与观察：**

*   **非金属 (Dielectric):** 将 F0 的 R, G, B 都设为 0.04 左右。
    *   当 `cosTheta` 接近 1.0 (垂直看) 时，反射率 `F` 非常低，接近 F0 (0.04)。
    *   当你减小 `cosTheta` 使其接近 0.0 (掠射角看) 时，你会看到反射率 `F` 的 R, G, B 值都显著增加，趋近于 1.0 (白色)。这就是为什么即使是粗糙的非金属表面，在边缘看起来也更亮。
*   **金属 (Metallic):** 尝试设置 F0 为一个典型的金属颜色，比如黄金 (R=1.0, G=0.71, B=0.29)。
    *   你会发现即使在 `cosTheta = 1.0` (垂直看) 时，反射率 `F` 也已经很高了 (等于 F0)。
    *   当 `cosTheta` 趋近于 0.0 时，反射率 `F` 仍然会增加，趋近于 1.0 (白色)，但基础反射率已经很高了。

这个简单的例子让你直观地感受到了菲涅尔效应——它是 PBR BRDF 中模拟真实世界反射行为的关键部分之一，解释了为什么物体边缘看起来更亮，以及金属和非金属反射方式的根本区别。

### 总结

PBR BRDF 是现代计算机图形学中实现逼真渲染的核心技术。它通过基于物理的微表面理论，将表面反射分解为漫反射和镜面反射两部分，并使用 NDF、G、F 等组件来精确模拟光线与材质的复杂交互。相比传统模型，它能更好地表现各种材质的独特性质，并在不同光照下保持一致性和能量守恒，最终带来更真实可信的视觉效果。理解其背后的原理和常用模型（如 Cook-Torrance）是深入学习 PBR 的关键一步。