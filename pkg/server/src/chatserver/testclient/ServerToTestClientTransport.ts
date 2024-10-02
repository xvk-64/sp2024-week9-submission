import type {IServerToClientTransport} from "../IServerToClientTransport.js";
import type {TestClientTransport} from "./TestClientTransport.js";
import {ClientSendable, ServerToClientSendable} from "@sp24/common/messageTypes.js";
import {EventEmitter, EventQueue} from "@sp24/common/util/EventEmitter.js"

export class ServerToTestClientTransport implements IServerToClientTransport {
    private _testClientTransport: TestClientTransport;

    onDisconnect: EventEmitter<void> = new EventEmitter<void>();
    onReceiveMessage: EventQueue<ClientSendable> = new EventQueue<ClientSendable>();

    async sendMessage(message: ServerToClientSendable): Promise<void> {
        await this._testClientTransport.onReceiveMessage.dispatch(message);

        return Promise.resolve();
    }

    public constructor(testClientTransport: TestClientTransport) {
        this._testClientTransport = testClientTransport;
        testClientTransport.onSendMessage.createListener(async (message: ClientSendable) => this.onReceiveMessage.dispatch(message));
    }
}