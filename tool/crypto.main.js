// main.js
import { 
    generateRsaKeyPair, 
    encrypt, 
    decrypt,
    pemToArrayBuffer,
    arrayBufferToPem
} from './crypto-util.js';

// --- DOM 元素 ---
const generateKeysBtn = document.getElementById('generateKeysBtn');
const publicKeyPemEl = document.getElementById('publicKeyPem');
const privateKeyPemEl = document.getElementById('privateKeyPem');
const plaintextEl = document.getElementById('plaintext');
const encryptBtn = document.getElementById('encryptBtn');
const decryptBtn = document.getElementById('decryptBtn');
const encryptedDataInputEl = document.getElementById('encrypted-data-input');
const decryptedOutputEl = document.getElementById('decrypted-output');
const statOriginalEl = document.getElementById('stat-original');
const statCompressedEl = document.getElementById('stat-compressed');
const statFinalEl = document.getElementById('stat-final');

// --- 事件监听 ---

generateKeysBtn.addEventListener('click', async () => {
    try {
        console.log("正在生成 2048-bit RSA 密钥对...");
        const keyPair = await generateRsaKeyPair();
        console.log("密钥对生成完毕，正在导出为 PEM 格式...");

        const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
        publicKeyPemEl.value = arrayBufferToPem(publicKeyBuffer, 'PUBLIC KEY');

        const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        privateKeyPemEl.value = arrayBufferToPem(privateKeyBuffer, 'PRIVATE KEY');
        
        console.log("PEM 密钥已填充到文本框。");
    } catch (error) {
        console.error("密钥生成或导出失败:", error);
        alert(`密钥操作失败: ${error.message}`);
    }
});

encryptBtn.addEventListener('click', async () => {
    const publicKeyPem = publicKeyPemEl.value;
    const plaintext = plaintextEl.value;

    if (!publicKeyPem) {
        alert("请输入公钥 (PEM 格式)。");
        return;
    }
    if (!plaintext) {
        alert("请输入要加密的明文。");
        return;
    }

    resetOutputs();

    try {
        console.log("开始导入 PEM 公钥...");
        const publicKeyBuffer = pemToArrayBuffer(publicKeyPem);
        const publicKey = await window.crypto.subtle.importKey(
            'spki',
            publicKeyBuffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ['encrypt']
        );
        console.log("公钥导入成功。");

        console.log("开始加密...");
        const result = await encrypt(plaintext, publicKey);
        console.log("加密完成。");

        const formattedJson = JSON.stringify(JSON.parse(result.encryptedPackageJson), null, 2);
        encryptedDataInputEl.value = formattedJson;
        
        statOriginalEl.textContent = result.stats.originalSize;
        statCompressedEl.textContent = result.stats.compressedSize;
        statFinalEl.textContent = result.stats.finalSize;
        
    } catch (error) {
        console.error("加密失败:", error);
        alert(`加密失败: ${error.message}. 请检查公钥 PEM 格式是否正确。`);
    }
});

decryptBtn.addEventListener('click', async () => {
    const privateKeyPem = privateKeyPemEl.value;
    const encryptedPackageJson = encryptedDataInputEl.value;

    if (!privateKeyPem) {
        alert("请输入私钥 (PEM 格式)。");
        return;
    }
    if (!encryptedPackageJson) {
        alert("请在数据包输入框中粘贴要解密的数据。");
        return;
    }

    // 重置输出，为新结果做准备
    decryptedOutputEl.textContent = '';
    statOriginalEl.textContent = 'N/A';
    statCompressedEl.textContent = 'N/A';
    statFinalEl.textContent = 'N/A';

    try {
        console.log("开始导入 PEM 私钥...");
        const privateKeyBuffer = pemToArrayBuffer(privateKeyPem);
        const privateKey = await window.crypto.subtle.importKey(
            'pkcs8',
            privateKeyBuffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ['decrypt']
        );
        console.log("私钥导入成功。");

        console.log("开始解密...");
        const result = await decrypt(encryptedPackageJson, privateKey);
        console.log("解密完成。");

        // 更新解密文本和统计信息
        decryptedOutputEl.textContent = result.decryptedText;
        statOriginalEl.textContent = result.stats.originalSize;
        statCompressedEl.textContent = result.stats.compressedSize;
        statFinalEl.textContent = result.stats.finalSize;

    } catch (error) {
        console.error("解密失败:", error);
        alert(`解密失败: ${error.message}. 请检查私钥 PEM 格式是否正确，以及是否与加密公钥匹配。`);
    }
});

// --- 辅助函数 ---
function resetOutputs() {
    // 此函数现在主要由加密操作调用，以清空所有相关字段
    encryptedDataInputEl.value = '';
    decryptedOutputEl.textContent = '';
    statOriginalEl.textContent = 'N/A';
    statCompressedEl.textContent = 'N/A';
    statFinalEl.textContent = 'N/A';
}