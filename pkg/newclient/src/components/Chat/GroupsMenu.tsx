import React, {useEffect} from "react";
import {useState} from "react";

export type GroupsMenuProps = {
    allGroupIDs: string[];
    selectedGroupID: string;
    onSelectGroupID: (groupID: string) => void;
}

export function GroupsMenu(props: GroupsMenuProps) {
    useEffect(() => {
        if (!props.allGroupIDs.includes(props.selectedGroupID)) {
            props.onSelectGroupID("");
        }
    })

    const groups = ["", ...props.allGroupIDs];

    return (
        <>
            <div>
                <strong>Group selection:</strong>
                {groups.map(group => (
                    <button key={group} onClick={() => props.onSelectGroupID(group)} disabled={props.selectedGroupID === group}>{group === "" ? "Global" : group}</button>
                ))}
            </div>
        </>
    )
}