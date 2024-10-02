import React, {useContext, useEffect, useState} from "react";
import {ClientContext} from "../context/ClientContext.js";
import {GroupsMenu} from "./Chat/GroupsMenu.js";
import {Message, MessageGroups, MessageWindow} from "./Chat/MessageWindow.js";
import {PublicChat, Chat} from "@sp24/common/chatclient/ChatClient.js";
import {CleartextChat} from "@sp24/common/messageTypes.js";
import {MessageBox} from "./Chat/MessageBox.js";
import {UserPicker} from "./Chat/UserPicker.js";

export type ChatProps = {

}

export function Chat(props: ChatProps) {
    const client = useContext(ClientContext);

    const [fingerprint, setFingerprint] = useState("");
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

    const [selectedGroupID, setSelectedGroupID] = useState("");
    const [allGroupIDs, setAllGroupIDs] = useState<string[]>([]);
    function onSelectGroupID(groupID: string) {
        setSelectedGroupID(groupID);
    }

    const [messageGroups, setMessageGroups] = useState<MessageGroups>(new Map([["", []]]))

    // On client update
    useEffect(() => {
        const clientUpdateListener = client?.current?.onClientUpdate.createListener(() => {
            setFingerprint(client?.current?.fingerprint || "");

            setOnlineUsers(client?.current?.getOnlineClients().map(c => c.fingerprint).filter(f => f != fingerprint) || []);
        });

        // Cleanup
        return () => {
            if (clientUpdateListener !== undefined)
                client?.current?.onClientUpdate.removeListener(clientUpdateListener);
        }
    }, [allGroupIDs, fingerprint, onlineUsers]);

    // On public chat
    useEffect(() => {
        const publicChatListener = client?.current?.onPublicChat.createListener(data => {
            setMessageGroups(mg => new Map(mg.set("", [...mg.get("")!, {
                senderFingerprint: data.senderFingerprint,
                text: data.message,
                key: crypto.randomUUID()
            }])));
        })

        // Cleanup
        return () => {
            if (publicChatListener !== undefined)
                client?.current?.onPublicChat.removeListener(publicChatListener);
        }
    }, []);

    // On chat
    useEffect(() => {
        const chatListener = client?.current?.onChat.createListener(data => {
            if (!allGroupIDs.includes(data.groupID))
                setAllGroupIDs([...allGroupIDs, data.groupID]);
            if (!(messageGroups.has(data.groupID)))
                setMessageGroups(mg => new Map(mg.set(data.groupID, [])));

            setMessageGroups(mg => new Map(mg.set(data.groupID, mg.get(data.groupID)!.concat({
                senderFingerprint: data.senderFingerprint,
                text: data.message,
                key: crypto.randomUUID()
            }))));
        });

        // Cleanup
        return () => {
            if (chatListener !== undefined)
                client?.current?.onChat.removeListener(chatListener);
        }
    }, [allGroupIDs, messageGroups]);

    function onSendMessage(messageText: string) {
        if (selectedGroupID === "") {
            client?.current?.sendPublicChat(messageText);
        } else {
            client?.current?.sendChat(messageText, selectedGroupID);
        }

        const message: Message = {
            senderFingerprint: fingerprint,
            text: messageText,
            key: crypto.randomUUID()
        };

        if (!(messageGroups.has(selectedGroupID)))
            setMessageGroups(mg => new Map(mg.set(selectedGroupID, [])));

        setMessageGroups(mg => new Map(mg.set(selectedGroupID, mg.get(selectedGroupID)!.concat(message))));
    }

    function onGroup(groupID: string) {
        if (!allGroupIDs.includes(groupID))
            setAllGroupIDs([...allGroupIDs, groupID]);
    }

    return (
        <>
            <span>Logged in as {fingerprint}</span>
            <GroupsMenu selectedGroupID={selectedGroupID} allGroupIDs={allGroupIDs} onSelectGroupID={onSelectGroupID} />
            <UserPicker onlineUsers={onlineUsers} onGroup={onGroup}/>
            <MessageBox onSendMessage={onSendMessage}/>
            <MessageWindow messages={messageGroups.get(selectedGroupID) || []} />
        </>
    )
}