import {EventEmitter, EventQueue} from "@sp24/common/util/EventEmitter.js"
import type {IServerToServerTransport} from "./IServerToServerTransport.js";
import {IServerToClientTransport} from "./IServerToClientTransport.js";
import {webcrypto} from "node:crypto";
import {ConnectedClient} from "./ConnectedClient.js";
import {ConnectedServer} from "./ConnectedServer.js";
import {NeighbourhoodAllowList} from "./NeighbourhoodAllowList.js";
import {ServerHelloData, SignedData} from "@sp24/common/messageTypes.js";

// Defines an entry point for new connections to a server.
export abstract class EntryPoint {
    readonly onClientConnect: EventQueue<ConnectedClient> = new EventQueue();
    readonly onServerConnect: EventQueue<ConnectedServer> = new EventQueue();

    protected _neighbourhood: NeighbourhoodAllowList;

    protected constructor(neighbourhood: NeighbourhoodAllowList) {
        this._neighbourhood = neighbourhood;
    }

    public async connectToServer(serverTransport: IServerToServerTransport, helloMessage: SignedData<ServerHelloData>) {
        // Wait for a hello message
        const messageListener = serverTransport.onReceiveMessage.createListener(async message => {
            if (message.type === "signed_data") {
                if (message.data.type == "server_hello") {
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
                    serverTransport.onReceiveMessage.removeListener(messageListener);

                    const connectedServer = new ConnectedServer(serverTransport, this, entry, message.counter, this._neighbourhood);

                    this.onServerConnect.dispatch(connectedServer);
                }
            }
        });

        // Send a hello message
        await serverTransport.sendMessage(helloMessage);
    }
}