import React from "react";
import {useState} from "react";
import {WebSocketClientTransport} from "../client/WebSocketClientTransport.js";

export type LoginProps = {
    onConnect: (transport: WebSocketClientTransport) => void;
}

export function Login(props: LoginProps) {
    const [statusMessage, setStatusMessage] = useState("Enter server address below.")
    const [serverAddress, setServerAddress] = useState<string>("ws://localhost:3307");
    const [inputEnabled, setInputEnabled] = useState<boolean>(true);

    const onFormSubmit: React.FormEventHandler<HTMLFormElement> = e => {
        e.preventDefault();

        setInputEnabled(false);
        setStatusMessage("Checking...");

        WebSocketClientTransport.connect(serverAddress)
            .then(transport => {
                // Successfully connected.
                setStatusMessage("Connected! Loading app...");

                props.onConnect(transport);
            })
            .catch(err => {
                setInputEnabled(true);
                setStatusMessage("Invalid server address.");
            })
    }

    return (
        <>
            <span>{statusMessage}</span>
            <form onSubmit={onFormSubmit}>
                <input type="text" value={serverAddress} onChange={(e) => setServerAddress(e.target.value)} disabled={!inputEnabled} />
                <input type="submit" value="Connect" disabled={!inputEnabled} />
            </form>
        </>
    )
}