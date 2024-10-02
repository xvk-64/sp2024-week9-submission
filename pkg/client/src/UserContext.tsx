import React, { createContext, useEffect, useState } from "react";

export interface GroupInfo {
    users: string[],
}

export interface Group {
    groupInfo: GroupInfo,
    chatLog: string[],
}

export interface User {
    // the user's keys
    keyPair: CryptoKeyPair,
    // the user's friends map
    friends: Map<string, string>,
    // the user's groups (with chat logs)
    groups: Group[],
    // the user's known servers
    servers: string[],
}

export type UserContext = {
    userKeys: CryptoKeyPair | null,
    setUser: (user: User) => void,
    friends: Map<string, string>,
    updateFriend: (publicKey: string, newUsername: string) => void,
    removeFriend: (publicKey: string) => void,
    groups: Group[],
    addGroup: (group: Group) => void,
    appendMessage: (groupIndex: number, message: string) => void,
    servers: string[],
    addServer: (server: string) => void,
}

// TODO: map out this type
export const UserContext: React.Context<UserContext | null> = createContext<UserContext | null>(null);

// TODO: what is this type?
export const UserProvider = ({ children }: any) => {
    const [loaded, setLoaded] = useState(false);

    const [friends, setFriends] = useState(new Map<string, string>());
    const updateFriend = (publicKey: string, newUsername: string) => {
        setFriends(prevFriends => {
            const newMap = new Map(prevFriends);
            newMap.set(publicKey, newUsername);
            return newMap;
        });
    } // check for name collision
    const removeFriend = (publicKey: string) => {
        setFriends(prevFriends => {
            const newMap = new Map(prevFriends);
            newMap.delete(publicKey);
            return newMap;
        });
    }
    
    const [groups, setGroups] = useState<Group[]>([]);
    const addGroup = (group: Group) => {
        setGroups(prevGroups => [...prevGroups, group])
    }
    const appendMessage = (groupIndex: number, message: string) => {
        const newGroups = groups.slice();
        newGroups[groupIndex].chatLog.push(message);
        setGroups(newGroups);
    }
    
    const [servers, setServers] = useState<string[]>([]);
    const addServer = (server: string) => {
        setServers(prevServers => [...prevServers, server])
    }
    
    const [userKeys, setUserKeys] = useState<CryptoKeyPair | null>(null);

    const setUser = (user: User) => {
        setUserKeys(user.keyPair);
        setFriends(user.friends);
        setGroups(user.groups);
        setServers(user.servers);
    }

    // then initialise it by checking the localstorage
    useEffect(() => {
        let localKeyPair = localStorage.getItem("keyPair");
        if(localKeyPair) {
            setUserKeys(JSON.parse(localKeyPair)); // this is not how this is supposed to be loaded
            let localFriends = localStorage.getItem("friends");
            if(localFriends) {setFriends(new Map(Object.entries(JSON.parse(localFriends))));}
            let localGroups = localStorage.getItem("groups");
            if(localGroups) {setGroups(JSON.parse(localGroups));}
            let localServers = localStorage.getItem("servers");
            if(localServers) {setServers(JSON.parse(localServers));}
        }
        setLoaded(true);
    }, []);
    useEffect(() => {
        if(loaded)
            localStorage.setItem("friends", JSON.stringify(friends));
    }, [friends, loaded]);
    useEffect(() => {
        if(loaded)
            localStorage.setItem("groups", JSON.stringify(groups));
    }, [groups, loaded]);
    useEffect(() => {
        if(loaded)
            localStorage.setItem("servers", JSON.stringify(servers));
    }, [servers, loaded]);
    useEffect(() => {
        if(loaded)
            // no idea if that's a valid way of storing the keys
            localStorage.setItem("keyPair", JSON.stringify(userKeys));
    }, [userKeys, loaded]);

    const ret = {
        userKeys,
        setUser,
        friends,
        updateFriend,
        removeFriend,
        groups,
        addGroup,
        appendMessage,
        servers,
        addServer,
    };
    return <UserContext.Provider value={ret}>
        {children}
    </UserContext.Provider>
}