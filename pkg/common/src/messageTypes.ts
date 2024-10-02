import  {type Protocol} from "./protocol/messageTypes.js";
import {decode, encode} from "base64-arraybuffer";
import {
    AESGenParams,
    calculateFingerprint,
    OAEPParams,
    PEMToKey,
    PSSParams,
    keyToPEM, PSSImportParams
} from "./util/crypto.js";

const webCrypto = globalThis.crypto.subtle;



/// These are typings that are more friendly for client/server development in our environment.
/// They use special objects that aren't directly synthesisable to JSON. (Crypto, ArrayBuffer...)

interface IMessage<TProtocolMessage extends Protocol.ProtocolMessage> {
    type: string;
    toProtocol(): Promise<TProtocolMessage>;
}
interface IMessageData<TData extends Protocol.SignedDataEntry> {
    type: string;
    toProtocol(): Promise<TData>;
}


export class HelloData implements IMessageData<Protocol.HelloData> {
    type: "hello" = "hello"
    readonly verifyKey: CryptoKey;

    static readonly response = "Hello!";

    public constructor(verifyKey: CryptoKey) {
        this.verifyKey = verifyKey;
    }

    async toProtocol(): Promise<Protocol.HelloData> {
        // Export public key.
        const exportedPEM = await keyToPEM(this.verifyKey);

        return {
            type: "hello",
            public_key: exportedPEM,
        }
    }
    static async fromProtocol(protocolData: Protocol.HelloData): Promise<HelloData> {
        // Import the key from the PEM
        return new HelloData(await PEMToKey(protocolData.public_key, PSSImportParams));
    }
}
export class CleartextChat {
    readonly destinationServers: string[];
    readonly senderFingerprint: string;
    readonly recipientFingerprints: string[];
    readonly message: string;

    public constructor(destinationServers: string[], senderFingerprint: string, recipientFingerprints: string[], message: string) {
        this.destinationServers = destinationServers;
        this.senderFingerprint = senderFingerprint;
        this.recipientFingerprints = recipientFingerprints;
        this.message = message;
    }
}
export class ChatData implements IMessageData<Protocol.ChatData> {
    type: "chat" = "chat";
    readonly destinationServers: string[];
    readonly iv: ArrayBuffer;
    readonly symm_keys: ArrayBuffer[];
    readonly chat: ArrayBuffer;

    private constructor(destinationServers: string[], iv: ArrayBuffer, symm_keys: ArrayBuffer[], chat: ArrayBuffer) {
        this.destinationServers = destinationServers;
        this.iv = iv;
        this.symm_keys = symm_keys;
        this.chat = chat;
    }

    toProtocol(): Promise<Protocol.ChatData> {
        return Promise.resolve({
            type: "chat",
            destination_servers: this.destinationServers,
            iv: encode(this.iv),
            symm_keys: this.symm_keys.map(key => encode(key)),
            chat: encode(this.chat),
        })
    }

    public async tryDecrypt(fingerprint: string, decryptKey: CryptoKey): Promise<CleartextChat | undefined> {
        const decoder = new TextDecoder("utf-8", {fatal: true});

        for (const encryptedKey of this.symm_keys) {
            try {
                // Get the symmetric key
                const symmKeyBuffer = await crypto.subtle.decrypt(OAEPParams, decryptKey, encryptedKey);
                const symmKey = await crypto.subtle.importKey("raw", symmKeyBuffer, "AES-GCM", true, ["encrypt", "decrypt"]);

                // Try decrypting the chat
                const AESParams: AesGcmParams = {
                    name: "AES-GCM",
                    iv: this.iv,
                    tagLength: 128
                };
                const decryptedBuffer = await crypto.subtle.decrypt(AESParams, symmKey, this.chat);
                const decryptedJSON = decoder.decode(decryptedBuffer);
                const decrypted = JSON.parse(decryptedJSON) as Protocol.Chat;

                if (!decrypted.participants.includes(fingerprint))
                    continue;

                return new CleartextChat(this.destinationServers, decrypted.participants[0], decrypted.participants.slice(1), decrypted.message);
            } catch (e) {
                // Some error so it probably wasn't the correct key
                // console.log(e);
                continue;
            }
        }
    }

    static fromProtocol(protocolData: Protocol.ChatData) {
        return new ChatData(
            protocolData.destination_servers,
            decode(protocolData.iv),
            protocolData.symm_keys.map(key => decode(key)),
            decode(protocolData.chat)
        );
    }

    static async create(message: string, senderFingerprint: string, recipientEncryptKeys: CryptoKey[], destinationServers: string[]): Promise<ChatData> {
        let participantFingerprints = [senderFingerprint];
        for (const key of recipientEncryptKeys)
            participantFingerprints.push(await calculateFingerprint(key));

        const chat: Protocol.Chat = {
            participants: participantFingerprints,
            message: message,
        };

        // Generate AES key
        let symmKey = await crypto.subtle.generateKey(AESGenParams, true, ["encrypt", "decrypt"]);

        let exportedKey = await crypto.subtle.exportKey("raw", symmKey);

        // Encrypt chat
        const iv = crypto.getRandomValues(new Uint8Array(16));
        const GCMParams: AesGcmParams = {
            name: "AES-GCM",
            iv: iv,
            tagLength: 128
        };
        let chatBuffer = new TextEncoder().encode(JSON.stringify(chat));
        let encryptedChat = await crypto.subtle.encrypt(GCMParams, symmKey, chatBuffer);

        // Encrypt keys for recipients
        let recipientSymmKeys = [];
        for (const key of recipientEncryptKeys)
            recipientSymmKeys.push(await crypto.subtle.encrypt(OAEPParams, key, exportedKey));

        return new ChatData(destinationServers, iv, recipientSymmKeys, encryptedChat);
    }
}
export class PublicChatData implements IMessageData<Protocol.PublicChatData> {
    type: "public_chat" = "public_chat";
    readonly senderFingerprint: string;
    readonly message: string;

    originalSender: string | undefined;

    public constructor(senderFingerprint: string, message: string) {
        this.senderFingerprint = senderFingerprint;
        this.message = message;
    }

    toProtocol(): Promise<Protocol.PublicChatData> {
        return Promise.resolve({
            type: "public_chat",
            sender: this.senderFingerprint,
            message: this.message,
        });
    }

    static fromProtocol(protocolData: Protocol.PublicChatData): PublicChatData {
        return new PublicChatData(protocolData.sender, protocolData.message);
    }
}
export class ServerHelloData implements IMessageData<Protocol.ServerHelloData> {
    type: "server_hello" = "server_hello";
    readonly serverAddress: string;

    public constructor(serverAddress: string) {
        this.serverAddress = serverAddress;
    }

    toProtocol(): Promise<Protocol.ServerHelloData> {
        return Promise.resolve({
            type: "server_hello",
            sender: this.serverAddress
        });
    }

    static fromProtocol(protocolData: Protocol.ServerHelloData): ServerHelloData {
        return new ServerHelloData(protocolData.sender);
    }
}
export class SignedData<TData extends IMessageData<Protocol.SignedDataEntry>> implements IMessage<Protocol.SignedData> {
    type: "signed_data" = "signed_data";
    readonly data: TData;
    readonly counter: number;
    readonly signature: ArrayBuffer;

    private constructor(data: TData, counter: number, signature: ArrayBuffer) {
        this.data = data;
        this.counter = counter;
        this.signature = signature;
    }

    public async verify(verifyKey: CryptoKey): Promise<boolean> {
        const payloadString = JSON.stringify(await this.data.toProtocol()) + this.counter.toString();
        const encodedPayload = new TextEncoder().encode(payloadString);

        try {
            return await crypto.subtle.verify(PSSParams, verifyKey, this.signature, encodedPayload);
        } catch (e) {
            console.log(e);
            return false
        }
    }

    static async create<TData extends IMessageData<Protocol.SignedDataEntry>>
        (data: TData, counter: number, signKey: CryptoKey): Promise<SignedData<TData>> {
        // Generate signature.
        const payloadString = JSON.stringify(await data.toProtocol()) + counter.toString();
        const encodedPayload = new TextEncoder().encode(payloadString);

        const signature = await webCrypto.sign(PSSParams, signKey, encodedPayload);

        return new SignedData(data, counter, signature);
    }

    async toProtocol(): Promise<Protocol.SignedData> {
        return {
            type: "signed_data",
            data: await this.data.toProtocol(),
            counter: this.counter,
            signature: encode(this.signature)
        };
    }
    static async fromProtocol(protocolMessage: Protocol.SignedData): Promise<SignedData<IMessageData<Protocol.SignedDataEntry>> | undefined> {
        let data = await (async () => {
            switch (protocolMessage.data.type) {
                case "hello":
                    return await HelloData.fromProtocol(protocolMessage.data as Protocol.HelloData);
                case "chat":
                    return ChatData.fromProtocol(protocolMessage.data as Protocol.ChatData);
                case "public_chat":
                    return PublicChatData.fromProtocol(protocolMessage.data as Protocol.PublicChatData);
                case "server_hello":
                    return ServerHelloData.fromProtocol(protocolMessage.data as Protocol.ServerHelloData);
                default:
                    return undefined;
            }
        })();

        if (data == undefined)
            // Error
            return undefined;

        return new SignedData(data, protocolMessage.counter, decode(protocolMessage.signature));
    }
}

export class ClientListRequest implements IMessage<Protocol.ClientListRequest> {
    type: "client_list_request" = "client_list_request";

    toProtocol(): Promise<Protocol.ClientListRequest> {
        return Promise.resolve({
            type: "client_list_request"
        });
    }

    static fromProtocol(protocolMessage: Protocol.ClientListRequest): ClientListRequest {
        return new ClientListRequest();
    }
}

export class ClientList implements IMessage<Protocol.ClientList> {
    type: "client_list" = "client_list";

    readonly servers: {
        address: string;
        clientVerifyKeys: CryptoKey[]
    }[];

    public constructor(servers: { address: string; clientVerifyKeys: CryptoKey[] }[]) {
        this.servers = servers;
    }

    async toProtocol(): Promise<Protocol.ClientList> {
        let resultServers: {
            address: string;
            clients: string[];
        }[] = [];

        for (const server of this.servers) {
            let resultClients = [];
            for (const key of server.clientVerifyKeys) {
                resultClients.push(await keyToPEM(key));
            }

            resultServers.push({address: server.address, clients: resultClients});
        }

        return {
            type: "client_list",
            servers: resultServers
        };
    }

    static async fromProtocol(protocolData: Protocol.ClientList) {
        let servers: {
            address: string;
            clientVerifyKeys: CryptoKey[]
        }[] = [];

        for (const server of protocolData.servers) {
            let keys: CryptoKey[] = [];
            for (const pem of server.clients)
                keys.push(await PEMToKey(pem, PSSImportParams));

            servers.push({address: server.address, clientVerifyKeys: keys});
        }

        return new ClientList(servers);
    }
}

export class ClientUpdate implements IMessage<Protocol.ClientUpdate> {
    type: "client_update" = "client_update";

    readonly clientVerifyKeys: CryptoKey[];

    public constructor(clients: CryptoKey[]) {
        this.clientVerifyKeys = clients;
    }

    async toProtocol(): Promise<Protocol.ClientUpdate> {
        let resultPEM: string[] = [];

        for (const key of this.clientVerifyKeys) {
            resultPEM.push(await keyToPEM(key));
        }

        return {
            type: "client_update",
            clients: resultPEM
        }
    }

    static async fromProtocol(protocolMessage: Protocol.ClientUpdate) {
        let keys: CryptoKey[] = [];

        for (const pem of protocolMessage.clients) {
            keys.push(await PEMToKey(pem, PSSImportParams));
        }

        return new ClientUpdate(keys);
    }

}

export class ClientUpdateRequest implements IMessage<Protocol.ClientUpdateRequest> {
    type: "client_update_request" = "client_update_request";

    toProtocol(): Promise<Protocol.ClientUpdateRequest> {
        return Promise.resolve({
            type: "client_update_request",
        });
    }

    static fromProtocol(protocolMessage: Protocol.ClientUpdateRequest) {
        return new ClientUpdateRequest();
    }
}

// Which message types is a client allowed to send?
export type ClientSendableSignedDataEntry = HelloData | ChatData | PublicChatData;
export type ClientSendableSignedData = SignedData<ClientSendableSignedDataEntry>;
// export type ClientSendableSignedData = SignedData<HelloData> | SignedData<ChatData> | SignedData<PublicChatData>;
export type ClientSendable = ClientSendableSignedData | ClientListRequest;

export type ClientToClientSendable = SignedData<ChatData | PublicChatData>;

// Which message types is a server allowed to send to another server?
export type ServerToServerSendableSignedDataEntry = ServerHelloData | ChatData | PublicChatData;
export type ServerToServerSendableSignedData = SignedData<ServerToServerSendableSignedDataEntry>;
// export type ServerToServerSendableSignedData = SignedData<ServerHelloData> | SignedData<ChatData> | SignedData<PublicChatData>;
export type ServerToServerSendable = ServerToServerSendableSignedData | ClientUpdateRequest | ClientUpdate;

// Which message types is a server allowed to send to a client?
export type ServerToClientSendableSignedDataEntry = ChatData | PublicChatData;
export type ServerToClientSendableSignedData = SignedData<ServerToClientSendableSignedDataEntry>;
// export type ServerToClientSendableSignedData = SignedData<ChatData> | SignedData<PublicChatData>;
export type ServerToClientSendable = ServerToClientSendableSignedData | ClientList;