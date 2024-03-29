import React, { useState } from "react";
import { getIndividualByID } from "@/app/utils/data/familyTree";
import { Individual } from "@/app/global/types";
import {
    Card,
    CardBody,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Button,
    useDisclosure,
} from "@nextui-org/react";
import { FaPlus } from "react-icons/fa";
import AddUserModal from "../modals/AddUserModal";

export default function UserCard({
    userID,
    treeData,
    handleDataUpdated,
}: {
    userID: string;
    treeData: Individual[];
    handleDataUpdated: () => void;
}) {
    const userData = getIndividualByID(userID, treeData);
    const [selectedKey, setSelectedKey] = useState("");
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const handleSelection = (key: string) => {
        setSelectedKey(key);
        onOpen();
    };

    const disabledKeys = [];
    if (userData?.fatherID && userData?.motherID ) disabledKeys.push("parent");
    if (userData?.spouseID) disabledKeys.push("spouse");

    const dropdownItems = [
        { key: "parent", label: "Add Parent" },
        { key: "spouse", label: "Add Spouse" },
        { key: "child", label: "Add Child" },
    ];

    return (
        <main className="relative">
            <Card radius="sm">
                <CardBody>
                    <p className="text-xs text-center">
                        {userData?.firstName} {userData?.lastName}
                    </p>
                </CardBody>
            </Card>
            <Dropdown>
                <DropdownTrigger>
                    <Button
                        variant="bordered"
                        isIconOnly
                        radius="full"
                        className="w-6 h-6 min-w-unit-6 absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2"
                    >
                        <FaPlus className="text-[10px]" />
                    </Button>
                </DropdownTrigger>
                <DropdownMenu
                    aria-label="Static Actions"
                    variant="bordered"
                    disabledKeys={disabledKeys}
                >
                    {dropdownItems.map((item) => (
                        <DropdownItem
                            key={item.key}
                            closeOnSelect={true}
                            onClick={() => handleSelection(item.key)}
                        >
                            {item.label}
                        </DropdownItem>
                    ))}
                </DropdownMenu>
            </Dropdown>
            <AddUserModal
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                userID={userID}
                treeData={treeData}
                selectionKey={selectedKey}
                onDataUpdated={handleDataUpdated}
            />
        </main>
    );
}
