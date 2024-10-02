import React, {useContext, useRef, useState} from "react";
import {Login} from "./components/Login.js";
import {WebSocketClientTransport} from "./client/WebSocketClientTransport.js";
import {PSSGenParams} from "@sp24/common/util/crypto.js";
import {ClientContext, ClientContextType} from "./context/ClientContext.js";
import {ChatClient} from "@sp24/common/chatclient/ChatClient.js";
import {Chat} from "./components/Chat.js";
import "./styles/App.css"

export function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const [client, setClient] = useState<ClientContextType>(useRef(undefined));

    async function onConnected(transport: WebSocketClientTransport) {
        if (client === undefined)
            // Client ref not set up.
            return;

        // Get keys
        const keyPair = await crypto.subtle.generateKey(PSSGenParams, true, ["sign", "verify"]);

        // Create client
        const newClient = await ChatClient.create(transport, keyPair.privateKey, keyPair.publicKey);
        newClient.useBetterKeygen = true;

        client.current = newClient;
        setIsLoggedIn(true);
    }

    return (
        <>
        {(isLoggedIn)
            ? <ClientContext.Provider value={client}><Chat/></ClientContext.Provider>
            : <Login onConnect={onConnected}/>
        }
        </>
    );
}