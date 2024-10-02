import {EventEmitter, EventQueue} from "@sp24/common/util/EventEmitter.js";
import { IServerToClientTransport } from "../IServerToClientTransport.js";
import {
    ChatData,
    ClientSendable, HelloData,
    PublicChatData,
    ServerToClientSendable,
    SignedData
} from "@sp24/common/messageTypes.js";
import {WebSocketTransport} from "@sp24/common/websocket/WebSocketTransport.js";

export class WebSocketServerToClientTransport implements IServerToClientTransport {
    private _transport: WebSocketTransport;

    readonly onReceiveMessage: EventQueue<ClientSendable> = new EventQueue();
    readonly onDisconnect: EventEmitter<void> = new EventEmitter();

    public constructor(transport: WebSocketTransport) {
        this._transport = transport;

        const receiveListener = transport.onReceiveMessage.createListener(async message => {
            // Filter to only client sendable.
            if (message.type == "client_list_request")
                await this.onReceiveMessage.dispatch(message);

            if (message.type == "signed_data") {
                if (message.data.type == "hello")
                    await this.onReceiveMessage.dispatch(message as SignedData<HelloData>);
                if (message.data.type == "chat")
                    await this.onReceiveMessage.dispatch(message as SignedData<ChatData>);
                if (message.data.type == "public_chat")
                    await this.onReceiveMessage.dispatch(message as SignedData<PublicChatData>)
            }
        });
        this._transport.onDisconnect.createListener(() => {
            this._transport.onReceiveMessage.removeListener(receiveListener);
        }, true);
    }

    async sendMessage(message: ServerToClientSendable): Promise<void> {
        await this._transport.sendMessage(message);
    }
}