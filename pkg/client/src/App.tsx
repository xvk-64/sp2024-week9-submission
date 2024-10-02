import React, {MutableRefObject, useEffect, useRef, useState} from "react";
import { ChatClient } from "@sp24/common/chatclient/ChatClient.js";
import {WebSocketClientTransport} from "./client/WebSocketClientTransport.js";
import {PSSGenParams} from "@sp24/common/util/crypto.js";

export const App : React.FC = () => {
    // useEffect(() => {
    //     localStorage.setItem("keyPair", "{\"privateKey\":\"test\",\"publicKey\":\"test\"}");
    //     localStorage.setItem("friends", "{\"TEST1\":\"alice\",\"TEST2\":\"bob\"}");
    //     localStorage.setItem("groups", '[{"groupInfo":{"users":["TEST1","TEST2"]},"chatLog":["hello", "hi", "whats going on?"]}]');
    //     localStorage.setItem("servers", "[\"http://localhost:3307/\"]");
    // }, []);
    // return <UserProvider><ChatBox></ChatBox></UserProvider>
    const chatClient = useRef<ChatClient>();
    useEffect(() => {
        (async () => {
            if (chatClient.current === undefined) {
                const transport = await WebSocketClientTransport.connect("ws://localhost:3307");

                if (transport === undefined) {
                    console.log("Failed to create socket");
                    return;
                }

                const clientKeys = await crypto.subtle.generateKey(PSSGenParams, true, ["sign", "verify"]);

                chatClient.current = await ChatClient.create(transport, clientKeys.privateKey, clientKeys.publicKey);

                chatClient.current.onChat.createListener((data) => {
                    console.log(`received chat ${data.message} from ${data.senderFingerprint} ${data.groupID}`);
                });
                chatClient.current.onPublicChat.createListener((data) => {
                    console.log(`received public chat ${data.message} from ${data.senderFingerprint}`);
                    chatClient.current?.sendChat("abcd", chatClient.current.getGroupID([data.senderFingerprint]));
                });
                setInterval(() => {
                    chatClient.current?.sendPublicChat("hello");
                }, 1000);
            }
        })();
    }, []);
    return <h1>Hi</h1>;
}