import {IServerToServerTransport} from "./IServerToServerTransport.js";
import {EntryPoint} from "./EntryPoint.js";
import {
    ClientSendable, ClientUpdate, ServerHelloData,
    ServerToClientSendable,
    ServerToServerSendable,
    ServerToServerSendableSignedData, SignedData
} from "@sp24/common/messageTypes.js";
import {EventEmitter, EventQueue} from "@sp24/common/util/EventEmitter.js";
import {webcrypto} from "node:crypto";
import {IServerToClientTransport} from "./IServerToClientTransport.js";
import {NeighbourhoodAllowList, NeighbourhoodServer} from "./NeighbourhoodAllowList.js";
import {Server} from "http";

export type NeighbourhoodClient = {
    verifyKey: webcrypto.CryptoKey;
}

// Server-side view of another server in the neighbourhood.
export class ConnectedServer {
    private _transport: IServerToServerTransport;

    private _clients: NeighbourhoodClient[] = [];
    public get clients(): NeighbourhoodClient[] {
        return this._clients;
    }

    private _neighbourhoodEntry: NeighbourhoodServer;
    public get neighbourhoodEntry() {
        return this._neighbourhoodEntry;
    }

    private _counter: number;

    private _neighbourhood: NeighbourhoodAllowList;

    public readonly entryPoint: EntryPoint;

    public async sendMessage(message: ServerToServerSendable): Promise<void> {
        return await this._transport.sendMessage(message);
    }

    public readonly onMessageReady: EventQueue<ServerToServerSendable> = new EventQueue();
    public readonly onDisconnect: EventEmitter<void> = new EventEmitter();

    public constructor(transport: IServerToServerTransport, entryPoint: EntryPoint, neighbourhoodEntry: NeighbourhoodServer, initialCounter: number, neighbourhood: NeighbourhoodAllowList) {
        this._transport = transport;
        this.entryPoint = entryPoint;
        this._neighbourhoodEntry = neighbourhoodEntry;
        this._counter = initialCounter;
        this._neighbourhood = neighbourhood;

        const messageListener = this._transport.onReceiveMessage.createListener(async message => {
            // console.log(message);

            // Validate signed data
            if (message.type == "signed_data") {
                const signedDataMessage = message as ServerToServerSendableSignedData;

                // See if this was sent by the server?
                if (signedDataMessage.data.type == "server_hello") {
                    // Update server key
                    const serverHelloMessage = signedDataMessage as SignedData<ServerHelloData>;

                    if (serverHelloMessage.counter <= this._counter)
                        // Invalid counter
                        return;

                    // Find new neighbourhood entry
                    const newEntry = this._neighbourhood.find(e => e.address == serverHelloMessage.data.serverAddress);

                    if (newEntry === undefined)
                        // Not in allow list.
                        return;

                    if (!await serverHelloMessage.verify(newEntry.verifyKey))
                        // Invalid signature
                        return;

                    // Update this entry
                    this._neighbourhoodEntry = newEntry;
                }
            }
            if (message.type == "client_update") {
                // Update my clients

                let clientUpdateMessage = message as ClientUpdate;
                this._clients = clientUpdateMessage.clientVerifyKeys.map(key => ({verifyKey: key}));
            }

            // Forward the message upwards
            await this.onMessageReady.dispatch(message);
        });

        this._transport.onDisconnect.createListener(() => {
            this._transport.onReceiveMessage.removeListener(messageListener);
            this.onDisconnect.dispatch();
        })
    }
}