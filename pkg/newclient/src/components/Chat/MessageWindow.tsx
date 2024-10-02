import React from "react";
import {MessageElement} from "./MessageElement.js";

export type Message = {
    text: string;
    senderFingerprint: string;
    key: string;
}

export type MessageGroups = Map<string, Message[]>;
export type MessageWindowProps = {
    messages: Message[];
}

export function MessageWindow(props: MessageWindowProps) {
    return (
        <>
            <div>
                {(props.messages.map(message =>
                    <MessageElement key={message.key} message={message} />
                ))}
            </div>
        </>
    )
}