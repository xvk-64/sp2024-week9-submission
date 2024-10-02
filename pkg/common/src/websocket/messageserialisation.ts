import {
    ChatData, ClientList, ClientListRequest,
    ClientSendable, ClientUpdate, ClientUpdateRequest,
    HelloData, PublicChatData, ServerHelloData,
    ServerToClientSendable,
    ServerToServerSendable,
    SignedData
} from "../messageTypes.js";

export type AnyMessage = ClientSendable | ServerToClientSendable | ServerToServerSendable;

const messageTypes = ["signed_data", "client_list_request", "client_update", "client_list", "client_update_request"];
const signedDataTypes = ["chat", "hello", "public_chat", "server_hello"];

export async function deserialiseMessage(message: string) : Promise<AnyMessage | undefined> {
    const parsed = JSON.parse(message);

    // Assert message type
    if (typeof parsed.type != "string") return;
    if (!messageTypes.includes(parsed.type)) return;

    switch (parsed.type) {
        case "signed_data":
            // Assert fields
            if (typeof parsed.counter != "number") return;
            if (typeof parsed.signature != "string") return;

            // Assert data
            if (typeof parsed.data != "object") return;
            const data = parsed.data;

            // Assert data type
            if (typeof data.type != "string") return;
            if (!signedDataTypes.includes(data.type)) return;

            switch (data.type) {
                case "chat":
                    // Assert fields
                    if (! (data.destination_servers instanceof Array)) return;
                    if (typeof data.iv != "string") return;
                    if (! (data.symm_keys instanceof Array)) return;
                    if (typeof data.chat != "string") return;

                    // All done.
                    return await SignedData.fromProtocol(parsed) as SignedData<ChatData>;
                case "hello":
                    // Assert fields
                    if (typeof data.public_key != "string") return;

                    // All done.
                    return await SignedData.fromProtocol(parsed) as SignedData<HelloData>;
                case "public_chat":
                    // Assert fields
                    if (typeof data.sender != "string") return;
                    if (typeof data.message != "string") return;

                    // All done.
                    return await SignedData.fromProtocol(parsed) as SignedData<PublicChatData>;
                case "server_hello":
                    // Assert fields
                    if (typeof data.sender != "string") return;

                    return await SignedData.fromProtocol(parsed) as SignedData<ServerHelloData>;
            }
            break;
        case "client_list_request":
            return ClientListRequest.fromProtocol(parsed);
        case "client_update":
            if (! (parsed.clients instanceof Array)) return;

            return await ClientUpdate.fromProtocol(parsed);
        case "client_list":
            if (! (parsed.servers instanceof Array)) return;
            if (parsed.servers.length != 0) {
                if (typeof parsed.servers[0].address != "string") return;
                if (! (parsed.servers[0].clients instanceof Array)) return;
            }

            return await ClientList.fromProtocol(parsed);
        case "client_update_request":
            return ClientUpdateRequest.fromProtocol(parsed);
    }
}