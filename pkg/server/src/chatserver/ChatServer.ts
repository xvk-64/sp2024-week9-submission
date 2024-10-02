// Main logic for server
import type {EntryPoint} from "./EntryPoint.js";
import {AsyncEventListener} from "@sp24/common/util/EventEmitter.js";
import {
    ChatData,
    ClientList,
    ClientSendable,
    ClientUpdate, ClientUpdateRequest,
    PublicChatData, ServerHelloData, ServerToServerSendable, SignedData
} from "@sp24/common/messageTypes.js";
import {ConnectedClient} from "./ConnectedClient.js";
import {webcrypto} from "node:crypto";
import {ConnectedServer} from "./ConnectedServer.js";
import {Router, RoutingEntry} from "./router/Router.js";
import {TestEntryPoint} from "./testclient/TestEntryPoint.js";


export class ChatServer {
    readonly address: string;
    private readonly _signKey: webcrypto.CryptoKey;
    private readonly _verifyKey: webcrypto.CryptoKey;
    private _counter: number = 0;

    private _entryPoints: EntryPoint[];

    private _routerEntryPoint = new TestEntryPoint([]);

    private _clients: ConnectedClient[] = [];

    private _routingTable: RoutingEntry[] = [];
    private _routers: Router[] = [];

    private _clientConnectListeners: AsyncEventListener<ConnectedClient>[] = [];
    private async onClientConnect(client: ConnectedClient) {
        console.log(`${this.address}: Client connected: ${client.fingerprint}`);

        for (const c of this._clients) {
            if (this._routingTable.find(e => e.middle == c.fingerprint) !== undefined)
                continue;

            const users: [string, string] = [client.fingerprint, c.fingerprint];
            const router = await Router.create(this._routerEntryPoint, users, this._routingTable);
            this._routers.push(router);
        }

        this._clients.push(client);

        const messageListener = client.onMessageReady.createListener(async message => {
            await this.onClientMessage(client, message);
        });

        // Do client_list to my clients
        await this.sendClientList();

        // Do client_update to other servers
        const clientUpdateMessage = new ClientUpdate(this._clients.map(client => client.verifyKey));
        for (const server of this._neighbourhoodServers)
            await server.sendMessage(clientUpdateMessage);

        // Handle disconnection
        client.onDisconnect.createListener(() => {
            console.log(`${this.address}: Client disconnected: ${client.fingerprint}`);
            client.onMessageReady.removeListener(messageListener);
            this._clients.splice(this._clients.indexOf(client), 1);
        }, true);
    }

    private async onRouterConnect(router: ConnectedClient) {
        console.log(`${this.address}: Router connected: ${router.fingerprint}`);

        this._clients.push(router);

        const messageListener = router.onMessageReady.createListener(async message => {
            await this.onClientMessage(router, message);
        });

        // Do client_list to my clients
        await this.sendClientList();

        // Do client_update to other servers
        const clientUpdateMessage = new ClientUpdate(this._clients.map(client => client.verifyKey));
        for (const server of this._neighbourhoodServers)
            await server.sendMessage(clientUpdateMessage);

        // Handle disconnection
        router.onDisconnect.createListener(() => {
            console.log(`${this.address}: Router disconnected: ${router.fingerprint}`);
            router.onMessageReady.removeListener(messageListener);
            this._clients.splice(this._clients.indexOf(router), 1);
        }, true);
    }

    private async sendClientList() {
        for (const client of this._clients) {
            const gaslightEntry = this._routingTable.find(e => e.middle === client.fingerprint);

            // List of all clients I know about

            const clientKeys: {[address: string]: webcrypto.CryptoKey[]} = {}

            if (gaslightEntry !== undefined) {
                // Is gaslight client

                clientKeys[this.address] = this._clients
                    .filter(client => gaslightEntry.users.includes(client.fingerprint))
                    .map(client => client.verifyKey)
            } else {
                // Is not gaslight client

                const gaslightFingerprints = this._routingTable
                    .filter(e => e.users.includes(client.fingerprint))
                    .map(e => e.middle);

                clientKeys[this.address] = this._clients
                    .filter(c => gaslightFingerprints.includes(c.fingerprint))
                    .map(c => c.verifyKey);
            }

        // Collect neighbourhood clients
        for (const server of this._neighbourhoodServers) {
            clientKeys[server.neighbourhoodEntry.address] = server.clients.map(client => client.verifyKey);
        }

            // Reformat data
            const clientList: {address: string, clientVerifyKeys: webcrypto.CryptoKey[]}[] = [];
            for (const address in clientKeys) {
                clientList.push({address: address, clientVerifyKeys: clientKeys[address]});
            }

            // Send client list
            const clientListMessage = new ClientList(clientList);
            await client.sendMessage(clientListMessage);
        }

    }

    private async onClientMessage(client: ConnectedClient, message: ClientSendable) {
        // We know the message has already been validated.

        // Check what to do with this message.
        switch (message.type) {
            case "signed_data":
                switch (message.data.type) {
                    case "hello":
                        // Do client_update to other servers
                        const clientUpdateMessage = new ClientUpdate(this._clients.map(client => client.verifyKey));
                        for (const server of this._neighbourhoodServers)
                            await server.sendMessage(clientUpdateMessage);

                        // Update routers
                        for (const entry of this._routingTable) {
                            if (entry.users[0] === client.previousFingerprint)
                                entry.users[0] = client.fingerprint;
                            if (entry.users[1] === client.previousFingerprint)
                                entry.users[1] = client.fingerprint;

                        // A client may have changed keys, send client update.
                        await this.sendClientList();
                        }
                        break;
                    case "chat": {
                        // Route to destination servers
                        const chatMessage = message as SignedData<ChatData>

                        // Relay to my clients.
                        if (chatMessage.data.destinationServers.includes(this.address))
                            await Promise.all(this._clients.map(client => client.sendMessage(chatMessage)))

                        // Relay to other servers
                        await Promise.all(
                            this._neighbourhoodServers.filter(server =>
                                chatMessage.data.destinationServers.includes(server.neighbourhoodEntry.address)
                                && server.neighbourhoodEntry.address != this.address
                            ).map(server => server.sendMessage(chatMessage))
                        );
                        break;
                    }
                    case "public_chat": {
                        const publicChatMessage = message as SignedData<PublicChatData>;

                        // Forward message on.

                        // Relay to my clients

                        const entry = this._routingTable.find(e => e.middle == client.fingerprint);
                        if (entry === undefined) {
                            const targetRouters = this._routingTable.filter(
                                e => e.users.includes(client.fingerprint)
                            ).map(e => e.middle);
                            await Promise.all(this._clients
                                .filter(c => targetRouters.includes(c.fingerprint))
                                .map(client => client.sendMessage(publicChatMessage)))
                        } else {
                            const originalSender = publicChatMessage.data.originalSender;
                            if (originalSender === undefined)
                                return;

                            const otherSender = entry.users[0] == originalSender ? entry.users[1] : entry.users[0];

                            this._clients.find(c=>c.fingerprint === otherSender)?.sendMessage(publicChatMessage);
                        }


                        // Relay to other servers
                        for (const server of this._neighbourhoodServers)
                            await server.sendMessage(publicChatMessage);
                        break;
                        }
                }
                break;
            case "client_list_request":
                // Do client_list
                await this.sendClientList();
                break;
        }
    }

    public async createServerHelloMessage() {
        const serverHelloData = new ServerHelloData(this.address);
        return await SignedData.create(serverHelloData, this._counter++, this._signKey);
    }

    private _neighbourhoodServers: ConnectedServer[] = [];

    private _serverConnectListeners: AsyncEventListener<ConnectedServer>[] = [];
    private async onServerConnect(server: ConnectedServer) {
        console.log(`${this.address}: Server connected: ${server.neighbourhoodEntry.address}`);

        this._neighbourhoodServers.push(server);

        const messageListener = server.onMessageReady.createListener(async message => {
            await this.onServerMessage(server, message);
        });

        // Reciprocate the connection with another server_hello.
        await server.sendMessage(await this.createServerHelloMessage());

        // Request client update
        await server.sendMessage(new ClientUpdateRequest());

        server.onDisconnect.createListener(() => {
            server.onMessageReady.removeListener(messageListener);
            this._neighbourhoodServers = this._neighbourhoodServers.filter(s => s != server);
        }, true);
    }

    private async onServerMessage(server: ConnectedServer, message: ServerToServerSendable) {
        // console.log(message);
        switch (message.type) {
            case "signed_data":
                switch (message.data.type) {
                    case "server_hello":
                        // Server has updated keys.
                        await this.sendClientList();
                        return
                    case "chat": {
                        const chatMessage = message as SignedData<ChatData>;

                        // Distribute to my clients
                        this._clients.forEach(client => client.sendMessage(chatMessage));
                        break;
                    }
                    case "public_chat": {
                        const publicChatMessage = message as SignedData<PublicChatData>;

                        // Distribute to my clients
                        this._clients.forEach(client => client.sendMessage(publicChatMessage));
                        break;
                    }
                }
                break;
            case "client_update_request": {
                // console.log(message)
                // We need to send a client update.

                const clientUpdateMessage = new ClientUpdate(this._clients.map(client => client.verifyKey));
                await server.sendMessage(clientUpdateMessage);
                break;
            }
            case "client_update":
                // The ConnectedServer will have already updated internal state.

                // Send a client list to my clients.
                await this.sendClientList();
                break;
        }
    }


    public constructor(address: string, entryPoints: EntryPoint[], signKey: webcrypto.CryptoKey, verifyKey: webcrypto.CryptoKey) {
        this.address = address;

        this._entryPoints = entryPoints;

        this._signKey = signKey;
        this._verifyKey = verifyKey;

        this._routerEntryPoint.onClientConnect.createListener(async (client) => {
            await this.onRouterConnect(client);
        })

        // Set up listeners for clients connecting to the server.
        entryPoints.forEach(entryPoint => {
            this._clientConnectListeners.push(entryPoint.onClientConnect.createListener(async (client) => {
                await this.onClientConnect(client);
            }));

            this._serverConnectListeners.push(entryPoint.onServerConnect.createListener(async (server) => {
                await this.onServerConnect(server);
            }))
        });
    }
}