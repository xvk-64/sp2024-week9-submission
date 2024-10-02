import {IChatClientTransport} from "@sp24/common/chatclient/IChatClientTransport.js";
import {WebSocketTransport} from "@sp24/common/websocket/WebSocketTransport.js";
import {EventEmitter, EventQueue} from "@sp24/common/util/EventEmitter.js";
import {
    ChatData,
    ClientSendable,
    PublicChatData,
    ServerToClientSendable,
    SignedData
} from "@sp24/common/messageTypes.js";


export class WebSocketClientTransport implements IChatClientTransport {
    private _transport: WebSocketTransport;

    readonly onReceiveMessage: EventQueue<ServerToClientSendable> = new EventQueue();
    readonly onDisconnect: EventEmitter<void> = new EventEmitter();

    public constructor(transport: WebSocketTransport) {
        this._transport = transport;

        const receiveListener = transport.onReceiveMessage.createListener(async message => {
            // Filter to only server sendable.
            if (message.type == "client_list")
                await this.onReceiveMessage.dispatch(message);

            if (message.type == "signed_data") {
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

    async sendMessage(message: ClientSendable): Promise<void> {
        await this._transport.sendMessage(message);
    }

    public static async connect(URL: string): Promise<WebSocketClientTransport> {
        return new Promise((resolve, reject) => {
            const webSocket = new WebSocket(URL);
            webSocket.onopen = () => resolve(new WebSocketClientTransport(new WebSocketTransport(webSocket)));
            webSocket.onerror = () => reject();
        });
    }
}