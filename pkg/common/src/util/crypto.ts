import {decode, encode} from "base64-arraybuffer";

const webCrypto = globalThis.crypto.subtle;

export const OAEPGenParams: RsaHashedKeyGenParams = {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1,0,1]),
    hash: "SHA-256"
}
export const OAEPImportParams: RsaHashedImportParams = {
    name: "RSA-OAEP",
    hash: "SHA-256"
}
export const OAEPParams: RsaOaepParams = {
    name: "RSA-OAEP",
}
export const PSSGenParams: RsaHashedKeyGenParams = {
    name: "RSA-PSS",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1,0,1]),
    hash: "SHA-256"
}
export const PSSImportParams: RsaHashedImportParams = {
    name: "RSA-PSS",
    hash: "SHA-256"
}
export const PSSParams: RsaPssParams = {
    name: "RSA-PSS",
    saltLength: 32
}

export const AESGenParams: AesKeyGenParams = {
    name: "AES-GCM",
    length: 128
}

export async function keyToPEM(key: CryptoKey) {
    if (key.type == "public") {
        const exported: ArrayBuffer = await webCrypto.exportKey("spki", key);
        return "-----BEGIN PUBLIC KEY-----\n" + encode(exported) + "\n-----END PUBLIC KEY-----";
    } else {
        const exported: ArrayBuffer = await webCrypto.exportKey("pkcs8", key);
        return "-----BEGIN PRIVATE KEY-----\n" + encode(exported) + "\n-----END PRIVATE KEY-----";
    }
}
export async function PEMToKey(pem: string, importParams: RsaHashedImportParams) {
    const publicPemHeader = "-----BEGIN PUBLIC KEY-----\n";
    const publicPemFooter = "\n-----END PUBLIC KEY-----";
    const privatePemHeader = "-----BEGIN PRIVATE KEY-----\n";
    const privatePemFooter = "\n-----END PRIVATE KEY-----";

    let pemContents = "";
    let isPrivate = true;
    if (pem.includes(publicPemHeader)) {
        isPrivate = false;

        pemContents = pem.substring(
            publicPemHeader.length,
            pem.length - publicPemFooter.length,
        );
    } else {
        pemContents = pem.substring(
            privatePemHeader.length,
            pem.length - privatePemFooter.length,
        );
    }

    const keyContents = decode(pemContents);

    return await webCrypto.importKey(isPrivate ? "pkcs8" : "spki", keyContents, importParams, true, isPrivate ? ["sign"] : ["verify"]);
}
export const verifyMessage = (message: string) => message == "Message is valid!"
export async function calculateFingerprint(key: CryptoKey) {
    let exportedKeyBuffer = new TextEncoder().encode(await keyToPEM(key));
    let fingerprintBuffer = await crypto.subtle.digest("SHA-256", exportedKeyBuffer);
    return encode(fingerprintBuffer);
}

export async function duplicateKey(publicKey: CryptoKey): Promise<{verifyKey: CryptoKey, encryptKey: CryptoKey}> {
    const exportedPub = await webCrypto.exportKey("spki", publicKey);
    const verify = await webCrypto.importKey("spki", exportedPub, PSSImportParams, true, ["verify"]);
    const encrypt = await webCrypto.importKey("spki", exportedPub, OAEPImportParams, true, ["encrypt"]);

    return {verifyKey: verify, encryptKey: encrypt};
}
