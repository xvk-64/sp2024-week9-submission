import {webcrypto} from "node:crypto";

// Address is a bit of a misnomer, since it doesn't have to be an IP address. It's more like a unique identifier of a server.

export type NeighbourhoodServer = {
    address: string,
    verifyKey: webcrypto.CryptoKey;
}

export type NeighbourhoodAllowList = NeighbourhoodServer[];