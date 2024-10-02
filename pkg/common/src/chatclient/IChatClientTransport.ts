import {type EventEmitter, EventQueue} from "../util/EventEmitter.js";
import {ClientSendable, ServerToClientSendable} from "../messageTypes.js";

// Client-side abstraction over the transport layer a client uses to send/receive from a server.
export interface IChatClientTransport {
    sendMessage(message: ClientSendable): Promise<void>;
    onReceiveMessage: EventQueue<ServerToClientSendable>;
    
    onDisconnect: EventEmitter<void>;
}