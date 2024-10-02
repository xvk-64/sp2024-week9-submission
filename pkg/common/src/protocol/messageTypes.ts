export namespace Protocol {
    /// These are typings that closely match the messages defined in the protocol.
    /// They should be directly convertible to/from JSON for transport.

    export type HelloData = {
        type: "hello";
        public_key: string;
    }
    export type ChatData = {
        type: "chat";
        destination_servers: string[];
        iv: string;
        symm_keys: string[];
        chat: string;
    }
    export type Chat = {
        participants: string[];
        message: string;
    }
    export type PublicChatData = {
        type: "public_chat";
        sender: string;
        message: string;
    }
    export type ServerHelloData = {
        type: "server_hello";
        sender: string;
    }
    export type SignedDataEntry = HelloData | ChatData | PublicChatData | ServerHelloData;
    export type SignedData = {
        type: "signed_data";
        data: SignedDataEntry;
        counter: number;
        signature: string;
    }

    export type ClientListRequest = {
        type: "client_list_request";
    }

    export type ClientList = {
        type: "client_list";
        servers: {
            address: string;
            clients: string[];
        }[];
    }

    export type ClientUpdate = {
        type: "client_update";
        clients: string[];
    }

    export type ClientUpdateRequest = {
        type: "client_update_request";
    }

    export type ProtocolMessage = SignedData | ClientListRequest | ClientList | ClientUpdate | ClientUpdateRequest;
}