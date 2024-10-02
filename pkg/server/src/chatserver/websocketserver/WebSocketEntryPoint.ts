import { EventEmitter } from "@sp24/common/util/EventEmitter.js";
import { EntryPoint } from "../EntryPoint.js";
import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import { WebSocketServerToClientTransport } from "./WebSocketServerToClientTransport.js";
import {ConnectedClient} from "../ConnectedClient.js";
import {ConnectedServer} from "../ConnectedServer.js";
import {ServerHelloData, SignedData} from "@sp24/common/messageTypes.js";
import {WebSocketTransport} from "@sp24/common/websocket/WebSocketTransport.js";
import {calculateFingerprint} from "@sp24/common/util/crypto.js";
import {NeighbourhoodAllowList} from "../NeighbourhoodAllowList.js";
import {WebsocketServerToServerTransport} from "./WebsocketServerToServerTransport.js";

export class WebSocketEntryPoint extends EntryPoint {
    private readonly _webSocketServer;

    private purgatory(transport: WebSocketTransport) {
        // Wait for a hello message...
        const messageListener = transport.onReceiveMessage.createListener(async message => {
            if (message.type == "signed_data") {
                if (message.data.type === "hello") {
                    // It's a client!

                    if (!await message.verify(message.data.verifyKey))
                        // Invalid signature
                        return;

                    // Remove listener as we have received the message we want.
                    transport.onReceiveMessage.removeListener(messageListener);

                    const client = new ConnectedClient(new WebSocketServerToClientTransport(transport), this, message.data.verifyKey, await calculateFingerprint(message.data.verifyKey), message.counter);

                    await this.onClientConnect.dispatch(client);
                }

                if (message.data.type === "server_hello") {
                    // It's a server!
                    const serverHelloMessage = message as SignedData<ServerHelloData>;

                    // Locate this server in the neighbourhood allow list
                    let entry = this._neighbourhood.find(server => server.address === serverHelloMessage.data.serverAddress);

                    if (entry === undefined)
                        // Not in neighbourhood allow list
                        return;

                    if (!await serverHelloMessage.verify(entry.verifyKey))
                        // Invalid signature
                        return;

                    // Remove listener as we have received the message we want.
                    transport.onReceiveMessage.removeListener(messageListener);

                    const connectedServer = new ConnectedServer(new WebsocketServerToServerTransport(transport), this, entry, message.counter, this._neighbourhood);

                    await this.onServerConnect.dispatch(connectedServer);
                }
            }
        })

        transport.onDisconnect.createListener(() => {
            transport.onReceiveMessage.removeListener(messageListener);
        }, true);
    }

    public constructor(httpServer: Server, neighbourhood: NeighbourhoodAllowList) {
        super(neighbourhood);

        this._webSocketServer = new WebSocketServer({server: httpServer});

        this._webSocketServer.on("connection", (webSocket: globalThis.WebSocket) => {
            this.purgatory(new WebSocketTransport(webSocket));
        });
    }
}