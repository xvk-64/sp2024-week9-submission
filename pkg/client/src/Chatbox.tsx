import React, { ReactElement, useContext, useState } from 'react'

import { User, UserContext } from './UserContext.js'

export default function ChatBox(){
    const {groups, appendMessage} = useContext(UserContext) || {} as UserContext;
    const [groupId, setGroupId] = useState(0);
    const [message, setMessage] = useState("");
    const [groupIdDraft, setGroupIdDraft] = useState("");
    const messages: ReactElement[] = groups[groupId]?.chatLog ? groups[groupId].chatLog.reduce(
        (acc: ReactElement[], message, index) => [...acc, <p key={index}>{message}</p>], []) : [<p key={0}>No messages</p>];
    const idInput = <input type="text" onChange={(event) => {setGroupIdDraft(event.target.value)}}></input>
    const messageInput = <input type="text" onChange={(event) => {setMessage(event.target.value)}}></input>
    return <>
        {idInput}
        <button onClick={() => {setGroupId(Number(groupIdDraft));}}>groupId</button>
        {messageInput}
        <button onClick={() => {appendMessage(groupId, message); console.log(message);}}>message</button>
        {messages}
    </>
}