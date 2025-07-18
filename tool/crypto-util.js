// crypto-util.js

// --- Base64 和 PEM 辅助函数 ---

/**
 * 将 ArrayBuffer 转换为 Base64 字符串。
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * 将 Base64 字符串转换为 ArrayBuffer。
 */
function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * 将 PEM 格式的密钥字符串转换为 ArrayBuffer。
 */
export function pemToArrayBuffer(pem) {
    const base64String = pem
        .replace(/-----BEGIN (PUBLIC|PRIVATE) KEY-----/, '')
        .replace(/-----END (PUBLIC|PRIVATE) KEY-----/, '')
        .replace(/\s/g, '');
    return base64ToArrayBuffer(base64String);
}

/**
 * 将包含密钥数据的 ArrayBuffer 转换为 PEM 格式字符串。
 */
export function arrayBufferToPem(buffer, label) {
    const base64String = arrayBufferToBase64(buffer);
    const chunks = base64String.match(/.{1,64}/g) || [];
    let pemString = `-----BEGIN ${label}-----\n`;
    pemString += chunks.join('\n');
    pemString += `\n-----END ${label}-----\n`;
    return pemString;
}


// --- 核心功能 ---

/**
 * 生成 RSA-OAEP 2048位密钥对。
 */
export async function generateRsaKeyPair() {
    return await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * 使用混合加密方案加密数据。
 */
export async function encrypt(plaintext, rsaPublicKey) {
    const stats = { originalSize: 0, compressedSize: 0, finalSize: 0 };
    const textEncoder = new TextEncoder();
    let dataToEncrypt = textEncoder.encode(plaintext);
    stats.originalSize = dataToEncrypt.byteLength;
    let compressed = false;

    if (typeof CompressionStream === 'function') {
        try {
            const cs = new CompressionStream('gzip');
            const writer = cs.writable.getWriter();
            writer.write(dataToEncrypt);
            writer.close();
            dataToEncrypt = await new Response(cs.readable).arrayBuffer();
            compressed = true;
        } catch (e) {
            console.warn("Compression failed, proceeding without it.", e);
            dataToEncrypt = textEncoder.encode(plaintext);
            compressed = false;
        }
    }
    stats.compressedSize = dataToEncrypt.byteLength;

    const aesKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, aesKey, dataToEncrypt);
    const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const encryptedAesKey = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsaPublicKey, exportedAesKey);

    const encryptedPackage = {
        encryptedKey: arrayBufferToBase64(encryptedAesKey),
        iv: arrayBufferToBase64(iv),
        data: arrayBufferToBase64(encryptedData),
        compressed: compressed,
    };

    const encryptedPackageJson = JSON.stringify(encryptedPackage);
    stats.finalSize = textEncoder.encode(encryptedPackageJson).byteLength;

    return { encryptedPackageJson, stats };
}

/**
 * 解密使用混合加密方案加密的数据。
 * @returns {Promise<{decryptedText: string, stats: object}>} 一个解析为包含解密文本和统计信息对象的Promise。
 */
export async function decrypt(encryptedPackageJson, rsaPrivateKey) {
    const stats = {
        originalSize: 0,
        compressedSize: 0,
        finalSize: 0,
    };
    const textEncoder = new TextEncoder();
    stats.finalSize = textEncoder.encode(encryptedPackageJson).byteLength;

    const encryptedPackage = JSON.parse(encryptedPackageJson);
    const encryptedAesKey = base64ToArrayBuffer(encryptedPackage.encryptedKey);
    const iv = base64ToArrayBuffer(encryptedPackage.iv);
    const encryptedData = base64ToArrayBuffer(encryptedPackage.data);
    stats.compressedSize = encryptedData.byteLength;

    const decryptedAesKeyRaw = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, rsaPrivateKey, encryptedAesKey);
    const aesKey = await window.crypto.subtle.importKey("raw", decryptedAesKeyRaw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
    const decryptedData = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, aesKey, encryptedData);

    let finalData = decryptedData;
    if (encryptedPackage.compressed && typeof DecompressionStream === 'function') {
        try {
            const ds = new DecompressionStream('gzip');
            const writer = ds.writable.getWriter();
            writer.write(finalData);
            writer.close();
            finalData = await new Response(ds.readable).arrayBuffer();
        } catch (e) {
            console.error("Decompression failed.", e);
            throw new Error("Decompression failed.");
        }
    }

    const textDecoder = new TextDecoder();
    const decryptedText = textDecoder.decode(finalData);
    stats.originalSize = textEncoder.encode(decryptedText).length;

    return { decryptedText, stats };
}

export function copyToClipboardLegacy(text) {
    // 创建临时文本框
    const textarea = document.createElement('textarea');
    textarea.value = text;

    // 隐藏文本框（不移出屏幕避免移动端问题）
    textarea.style.position = 'fixed';
    textarea.style.opacity = 0;

    // 将文本框添加到 DOM
    document.body.appendChild(textarea);

    // 选中文本
    textarea.select();
    textarea.setSelectionRange(0, 99999); // 适配移动端

    try {
        // 执行复制命令
        const successful = document.execCommand('copy');
        if (!successful) {
            throw new Error('复制命令失败');
        }
        console.log('复制成功');
        // 这里可以添加成功后的回调逻辑
    } catch (err) {
        console.error('复制失败:', err);
        // 这里可以添加错误处理逻辑
    } finally {
        // 清理 DOM
        document.body.removeChild(textarea);
    }
}