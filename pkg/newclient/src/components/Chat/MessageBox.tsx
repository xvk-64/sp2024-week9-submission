import React, {FormEvent, useState} from "react"

export type MessageBoxProps = {
    onSendMessage: (message: string) => void;
}

export function MessageBox (props: MessageBoxProps) {
    const [message, setMessage] = useState("");

    const onSend: React.FormEventHandler<HTMLFormElement> = e => {
        e.preventDefault();

        props.onSendMessage(message);
        setMessage("");
    }

    return <>
        <form onSubmit={onSend}>
            <input type="text" value={message} onChange={e => setMessage(e.target.value)} />
            <input type="submit" value="Send"/>
        </form>
    </>
}