import {IServerToClientTransport} from "./IServerToClientTransport.js";
import {
    ClientSendable,
    ClientSendableSignedData,
    HelloData,
    ServerToClientSendable,
    SignedData
} from "@sp24/common/messageTypes.js";
import {EventEmitter, EventQueue} from "@sp24/common/util/EventEmitter.js";
import {encode} from "base64-arraybuffer";
import {webcrypto} from "node:crypto";
import {EntryPoint} from "./EntryPoint.js";
import {calculateFingerprint} from "@sp24/common/util/crypto.js";

// A server-side view of a client connected to it.
export class ConnectedClient {
    private _transport: IServerToClientTransport;

    public readonly entryPoint: EntryPoint;

    public async sendMessage(message: ServerToClientSendable): Promise<void> {
        return await this._transport.sendMessage(message);
    }
    public readonly onMessageReady: EventQueue<ClientSendable> = new EventQueue();
    public readonly onDisconnect: EventEmitter<void> = new EventEmitter();

    private _counter: number;

    private _verifyKey: webcrypto.CryptoKey;
    public get verifyKey() {
        return this._verifyKey;
    }

    public previousFingerprint = "";
    private _fingerprint: string;
    public get fingerprint() {
        return this._fingerprint;
    }

    public constructor(transport: IServerToClientTransport, entryPoint: EntryPoint, initialVerifyKey: webcrypto.CryptoKey, initialFingerprint: string, initialCounter: number) {
        this._transport = transport;
        this.entryPoint = entryPoint;

        this._verifyKey = initialVerifyKey;
        this._fingerprint = initialFingerprint;
        this._counter = initialCounter;

        const receiveListener = this._transport.onReceiveMessage.createListener(async message => {
            // Validate signed data.
            if (message.type == "signed_data") {
                const signedDataMessage = message as ClientSendableSignedData;
                if (this._counter !== undefined && signedDataMessage.counter <= this._counter)
                    // Invalid counter value.
                    return;

                // Process hello message, update key...
                if (signedDataMessage.data.type == "hello") {
                    const helloData = signedDataMessage.data as HelloData;
                    if (!await signedDataMessage.verify(helloData.verifyKey))
                        // Invalid signature.
                        return;

                    // Update key
                    this._verifyKey = helloData.verifyKey;

                    this.previousFingerprint = this._fingerprint;
                    // Update fingerprint
                    this._fingerprint = await calculateFingerprint(this._verifyKey);
                }

                if (this._verifyKey === undefined)
                    // Need a key to send signed data.
                    return;

                if (!await signedDataMessage.verify(this._verifyKey))
                    // Invalid signature.
                    return;

                // Update counter
                this._counter = signedDataMessage.counter;
            }

            // Message is all valid, pass upwards.
            await this.onMessageReady.dispatch(message);
        });

        this._transport.onDisconnect.createListener(() => {
            this._transport.onReceiveMessage.removeListener(receiveListener);
            this.onDisconnect.dispatch();
        }, true);
    }
}