/* eslint-disable */
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

interface JSONRPCResponse {
    id: string;
    result: Record<string, any>;
}

/**
 * JSONRPCPeer - Handles JSON-RPC protocol over a message channel (WebRTC data channel)
 * Supports both request/response patterns and fire-and-forget notifications
 */
export class JSONRPCPeer {

    sender: (message: string) => void;
    responseQueue: Record<string, JSONRPCResponse | null> = {};
    handlerRegistry: Record<string, (params: Record<string, any>) => any> = {};

    // CONSTRUCTOR
    constructor(sender: (message: string) => void) {
        this.sender = sender;
    }

    // REGISTER HANDLER
    on = (method: string, handler: (params: Record<string, any>) => any) => {
        this.handlerRegistry[method] = handler;
    }

    // CALL METHOD
    call = async (
        method: string,
        params: Record<string, any>,
        awaitResponse: boolean = false,
        timeout: number = 5000
    ): Promise<Record<string, any> | void> => {

        // Set ID
        let id = null;
        if (awaitResponse) {
            id = uuidv4();
        }

        // Create message
        const message = JSON.stringify({
            method,
            params,
            id,
        });

        // Send message
        this.sender(message);

        // If we are not waiting for a response, return immediately
        if (!awaitResponse || id === null) {
            return;
        }

        // Queue response
        this.responseQueue[id] = null;

        // Wait for response
        const waitInterval = 100;
        let elapsedTime = 0;
        while (!this.responseQueue[id] && elapsedTime < timeout) {
            elapsedTime += waitInterval;
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Pull out response
        const response = this.responseQueue[id];
        delete this.responseQueue[id]

        // Check if we timed out
        if (!response) {
            throw new Error(`Timeout waiting for response to ${method}`);
        }

        // Check if response is an error
        if (response.result.error) {
            throw new Error(`Error in response to ${method}: ${response.result.error}`);
        }

        // Return response
        return response.result;
    }

    // HANDLE MESSAGE
    handleMessage = async (message: string) => {

        // Parse the string message
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message);
        } catch (e) {
            console.error("Error parsing message", e);
            return;
        }

        // If the message is a request
        if (parsedMessage.method && parsedMessage.params) {
            // Get handler
            const handler = this.handlerRegistry[parsedMessage.method];
            if (!handler) {
                console.error("Error: no handler for message", parsedMessage);
                return;
            }
            console.log("Handling request", parsedMessage.method);

            // If no response is expected
            if (!parsedMessage.id) {
                // Call handler and return
                handler(parsedMessage.params);
                return;
            }
            
            // Otherwise call handler and send response
            try {
                const response = await handler(parsedMessage.params);
                console.log("Response", response);
                this.sender(JSON.stringify({
                    id: parsedMessage.id,
                    result: response,
                }));
            } catch (e) {
                console.error("Error handling message", e);
                this.sender(JSON.stringify({
                    id: parsedMessage.id,
                    result: {
                        error: (e as Error).message,
                    },
                }));
            }
            return;
        }   

        // Check if the message is a response
        if (!parsedMessage.id || this.responseQueue[parsedMessage.id]) {
            console.error("Error: message is not a response", parsedMessage);
            return;
        }

        // Add response to queue
        this.responseQueue[parsedMessage.id] = parsedMessage;
    }
}

