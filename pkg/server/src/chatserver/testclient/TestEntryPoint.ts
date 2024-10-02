import {EntryPoint} from "../EntryPoint.js";
import {EventEmitter} from "@sp24/common/util/EventEmitter.js";
import  {TestClientTransport} from "./TestClientTransport.js";
import {ServerToTestClientTransport} from "./ServerToTestClientTransport.js";
import {ConnectedClient} from "../ConnectedClient.js";
import {calculateFingerprint} from "@sp24/common/util/crypto.js";
import {NeighbourhoodAllowList, NeighbourhoodServer} from "../NeighbourhoodAllowList.js";
import {TestServerToServerTransport} from "./TestServerToServerTransport.js";
import {IServerToServerTransport} from "../IServerToServerTransport.js";

export class TestEntryPoint extends EntryPoint {
    public constructor(neighbourhood: NeighbourhoodAllowList) {
        super(neighbourhood);
    }

    addClient(clientTransport: TestClientTransport) {
        let connectedTestClient = new ServerToTestClientTransport(clientTransport);

        // Wait until hello message
        const messageListener = connectedTestClient.onReceiveMessage.createListener(async message => {
            if (message.type === "signed_data") {
                if (message.data.type === "hello") {
                    if (!await message.verify(message.data.verifyKey))
                        // Invalid signature
                        return;

                    // Remove listener as we have received the message we want.
                    connectedTestClient.onReceiveMessage.removeListener(messageListener);

                    const client = new ConnectedClient(connectedTestClient, this, message.data.verifyKey, await calculateFingerprint(message.data.verifyKey), message.counter);

                    await this.onClientConnect.dispatch(client);
                }
            }
        });
    }
}