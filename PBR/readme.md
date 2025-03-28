好的，感谢您提供的详细信息！这有助于我们明确第一阶段的目标。

**确认我对任务范围的理解（第一阶段）：**

根据您的回复，我们第一阶段的任务是：

1.  **目标：** 使用 Three.js 的 `ShaderMaterial` 实现一个**简化版**的 PBR 效果，主要用于学习目的。
2.  **核心模型：** 采用标准的 **Cook-Torrance 微表面 BRDF**（包含 GGX NDF, Smith Geometry Function, Schlick Fresnel）用于镜面反射，并结合 **Lambertian 模型**用于漫反射。
3.  **材质输入：** PBR 材质属性（`baseColor`, `metallic`, `roughness`）将通过 **`uniform` 变量**从 JavaScript 传递给着色器。
4.  **光照：** 需要支持**直接光照**，具体包括**平行光（DirectionalLight）**和**点光源（PointLight）**。我们需要能够处理这些光源的位置/方向、颜色和强度。
5.  **排除项（第一阶段）：**
    *   **不**实现基于图像的光照（IBL），即使您会提供 HDR 贴图（我们可以在后续阶段使用）。
    *   **不**支持法线贴图、环境光遮蔽贴图或自发光贴图。
6.  **颜色空间：** 我们需要注意在着色器中进行光照计算时，应在线性颜色空间中进行。Three.js 默认会进行一些颜色管理，我们需要确保我们的着色器与此流程兼容（例如，输入颜色可能需要从 sRGB 转换到线性，最终输出可能由 Three.js 处理）。
7.  **重点：** 核心在于理解和实现着色器内部的 PBR 直接光照计算逻辑。

**评估：**

这个明确定义的范围是**合理且可行的**。它将 PBR 的核心直接光照部分分离出来，避免了 IBL 等更复杂的方面，非常适合作为学习的第一步。

**规划与确认：**

基于以上理解，我为您制定了以下分步骤执行计划草案：

**计划草案：**

1.  **步骤 1：基础场景与 ShaderMaterial 设置**
    *   创建一个基本的 Three.js 场景（包含相机、渲染器、一个简单的几何体如球体或立方体）。
    *   为该几何体创建一个 `ShaderMaterial`，并编写最基础的顶点着色器（仅进行坐标变换）和片元着色器（输出固定颜色）。
    *   确保场景能正常渲染。

2.  **步骤 2：顶点着色器数据传递**
    *   修改顶点着色器，计算并传递以下变量给片元着色器（使用 `varying`）：
        *   顶点在世界空间中的位置 (`vWorldPosition`)。
        *   顶点法线在世界空间中的方向 (`vWorldNormal`)。
        *   （可选，但推荐）从顶点指向相机的视图方向向量在世界空间中的表示 (`vViewDirection`)。

3.  **步骤 3：定义并传递 Uniforms**
    *   在 JavaScript 中定义 PBR 材质相关的 `uniform` 变量 (`uBaseColor`, `uMetallic`, `uRoughness`) 并设置初始值。
    *   在 JavaScript 中定义相机位置的 `uniform` (`uCameraPosition`)。
    *   在 `ShaderMaterial` 中声明这些 `uniforms`。
    *   在渲染循环中更新需要每帧更新的 `uniforms`（例如 `uCameraPosition`）。
    *   在片元着色器中接收这些 `uniforms`。

4.  **步骤 4：定义并传递光照 Uniforms**
    *   在 GLSL 中定义光源结构体（例如 `struct PointLight { vec3 position; vec3 color; float intensity; };` 和 `struct DirectionalLight { vec3 direction; vec3 color; float intensity; };`）。
    *   在 JavaScript 中准备光源数据（例如，创建一个包含点光源和平行光信息的数组或对象）。
    *   在 `ShaderMaterial` 中声明用于接收光源数据的 `uniforms`（可能是光源结构体数组，以及表示数量的 `uniform`，例如 `uniform PointLight uPointLights[NUM_POINT_LIGHTS]; uniform int uNumPointLights;` 等）。
    *   将光源数据从 JavaScript 传递给着色器 `uniforms`。

5.  **步骤 5：实现核心 PBR 函数 (GLSL 片元着色器)**
    *   在片元着色器中实现以下 PBR 核心计算函数：
        *   `NDF_GGX(N, H, roughness)`: 计算 GGX 法线分布。
        *   `Geometry_Smith(N, V, L, roughness)`: 计算 Smith 几何遮挡函数（结合 GGX）。
        *   `Fresnel_Schlick(cosTheta, F0)`: 计算 Schlick 菲涅尔近似。
        *   （辅助函数）计算基础反射率 `F0` (基于 `baseColor`, `metallic`)。

6.  **步骤 6：实现直接光照计算 (GLSL 片元着色器)**
    *   在片元着色器 `main` 函数中：
        *   获取表面属性（`baseColor`, `metallic`, `roughness`）和几何信息（`normal`, `viewDir`, `worldPos`）。
        *   计算 `F0`。
        *   初始化总的光照颜色 `Lo = vec3(0.0)`。
        *   **循环处理平行光：**
            *   获取光照方向 `L`、光照颜色 `lightColor`、强度 `intensity`。
            *   计算光照向量 `L` (注意方向)、视线向量 `V`、法线向量 `N`、半程向量 `H` (确保都在同一坐标系，如世界空间，并归一化)。
            *   计算 `NdotL` (注意 clamp 到 0)。
            *   计算 Cook-Torrance 镜面项（使用步骤 5 的函数）。
            *   计算 Lambertian 漫反射项。
            *   根据 `metallic` 混合漫反射和镜面反射颜色。
            *   计算该光源的贡献 `(kD * diffuse + kS * specular) * radiance * NdotL` (其中 `kD` 和 `kS` 基于能量守恒和菲涅尔)。
            *   累加到 `Lo`。
        *   **循环处理点光源：**
            *   类似平行光，但需要根据点光源位置计算光照方向 `L`。
            *   计算光源距离和衰减因子（例如，物理上正确的平方反比衰减）。
            *   将衰减因子应用到光源贡献上。
            *   累加到 `Lo`。
        *   （可选）添加一个非常简单的环境光项（例如 `ambient = vec3(0.03) * baseColor * (1.0 - metallic)`）来模拟全局光照，避免纯黑阴影。

7.  **步骤 7：最终颜色输出 (GLSL 片元着色器)**
    *   将计算得到的总光照 `Lo` (加上可选的环境光) 作为片元的最终颜色。
    *   进行颜色空间处理：确保最终输出 `gl_FragColor` 是 Three.js 期望的格式。如果输入 `uBaseColor` 是 sRGB，可能需要先转为线性；计算全程在线性空间进行；最终输出可能需要保留在线性空间，让 Three.js 处理输出编码（取决于 `renderer.outputEncoding` 设置）。我们将从最简单的方式开始，假设输入颜色和计算都在线性空间，并让 Three.js 处理输出。

**计划确认请求：**

这是我们执行任务的计划草案，您看是否合理？有哪些需要调整或补充的地方吗？

特别是关于步骤 4 中处理多个光源的方式（使用数组和数量 uniform），以及步骤 7 中颜色空间处理的初步简化假设，您是否同意？

在获得您对最终计划的明确批准之前，我不会开始执行任何步骤。