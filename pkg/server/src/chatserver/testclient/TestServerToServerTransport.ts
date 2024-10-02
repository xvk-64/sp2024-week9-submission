import {IServerToServerTransport} from "../IServerToServerTransport.js";
import {ServerToServerSendable} from "@sp24/common/messageTypes.js";
import {EventEmitter, EventQueue} from "@sp24/common/util/EventEmitter.js";

export class TestServerToServerTransport implements IServerToServerTransport {
    onDisconnect: EventEmitter<void> = new EventEmitter();
    onReceiveMessage: EventQueue<ServerToServerSendable> = new EventQueue();

    private _otherTransport: TestServerToServerTransport | undefined;

    private constructor() { }

    public static createPair(): [TestServerToServerTransport, TestServerToServerTransport] {
        const firstTransport = new TestServerToServerTransport();
        const secondTransport = new TestServerToServerTransport();

        firstTransport._otherTransport = secondTransport;
        secondTransport._otherTransport = firstTransport;

        return [firstTransport, secondTransport];
    }

    async sendMessage(message: ServerToServerSendable): Promise<void> {
        await this._otherTransport?.onReceiveMessage.dispatch(message);
    }
}