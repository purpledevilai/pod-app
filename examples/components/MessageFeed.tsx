import { observer } from "mobx-react-lite";
import { Box, Text, VStack } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { translatorRoomStore } from "../../stores/translatorroomstore";

export const MessageFeed = observer(() => {
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [translatorRoomStore.messages.length]);

    return (
        <Box
            width="100%"
            maxW="500px"
            border="1px solid"
            borderColor="gray.400"
            borderRadius="md"
            overflowY="auto"
            height="300px"
            p={4}
            bg="gray.700"
            color="white"
        >
            <VStack align="start" spacing={2}>
                {translatorRoomStore.messages.length !== 0 ? (
                    translatorRoomStore.messages.map((msg, idx) => (
                        <Text key={idx}>{msg}</Text>
                    ))
                ) : (
                    <Text>No transcript yet.</Text>
                )}
                <div ref={messagesEndRef} />
            </VStack>
        </Box>
    );
});
