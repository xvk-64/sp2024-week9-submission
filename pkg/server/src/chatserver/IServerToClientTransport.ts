import {EventEmitter, EventQueue} from "@sp24/common/util/EventEmitter.js";
import {ClientSendable, ServerToClientSendable} from "@sp24/common/messageTypes.js";

// Defines a server's view of a connected client
export interface IServerToClientTransport {
    sendMessage(message: ServerToClientSendable): Promise<void>;
    onReceiveMessage: EventQueue<ClientSendable>;

    onDisconnect: EventEmitter<void>;
}