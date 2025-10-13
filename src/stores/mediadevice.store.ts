import { makeAutoObservable } from "mobx";
import { PermissionsAndroid, Platform } from 'react-native';
import { MediaStream, mediaDevices } from 'react-native-webrtc';

/**
 * MediaDeviceStore - Manages media device permissions and audio stream
 * Simplified for mobile - focuses on microphone access only (no video for this app)
 */
class MediaDeviceStore {

    audioDevices: MediaDeviceInfo[] = [];
    selectedAudioDevice: MediaDeviceInfo | undefined = undefined;
    mediaStream: MediaStream | undefined = undefined;
    hasPermission: boolean = false;
    permissionError: string | undefined = undefined;

    constructor() {
        makeAutoObservable(this);
    }

    /**
     * Request microphone permission (Android only - iOS handled via Info.plist)
     */
    private async requestMicrophonePermission(): Promise<boolean> {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    {
                        title: 'Microphone Permission',
                        message: 'This app needs access to your microphone to enable voice conversations with the AI agent.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );
                
                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    console.log('Microphone permission granted');
                    this.hasPermission = true;
                    return true;
                } else {
                    console.log('Microphone permission denied');
                    this.permissionError = 'Microphone permission denied. Please enable it in settings.';
                    this.hasPermission = false;
                    return false;
                }
            } catch (err) {
                console.error('Error requesting microphone permission:', err);
                this.permissionError = 'Error requesting microphone permission';
                this.hasPermission = false;
                return false;
            }
        }
        
        // iOS permissions are handled via Info.plist
        // Permission will be requested when getUserMedia is called
        this.hasPermission = true;
        return true;
    }

    /**
     * Initialize media devices - requests permission and enumerates audio devices
     */
    initializeMediaDevices = async () => {
        try {
            console.log('Initializing media devices...');
            
            // Request microphone permission
            const hasPermission = await this.requestMicrophonePermission();
            if (!hasPermission) {
                throw new Error('Microphone permission not granted');
            }

            // Get initial media stream to trigger permission prompt on iOS
            const tempStream = await mediaDevices.getUserMedia({ audio: true, video: false });
            
            // Stop the temp stream immediately
            tempStream.getTracks().forEach(track => track.stop());

            // Enumerate devices
            const devices = await mediaDevices.enumerateDevices();
            console.log('Enumerated devices:', devices);

            // Filter for audio input devices
            if (!Array.isArray(devices)) {
                console.log('Devices is not an array');
                this.audioDevices = [];
                return;
            }

            this.audioDevices = devices.filter((d: any) => d.kind === "audioinput");
            console.log('Audio devices found:', this.audioDevices.length);

            // Set default device (first available)
            if (this.audioDevices.length > 0) {
                this.selectedAudioDevice = this.audioDevices[0];
            }

            this.hasPermission = true;
            this.permissionError = undefined;
        } catch (error) {
            console.error('Error initializing media devices:', error);
            this.permissionError = 'Failed to initialize microphone. Please check permissions.';
            this.hasPermission = false;
            throw error;
        }
    }

    /**
     * Get media stream with current device selection
     */
    async getMediaStream(deviceId?: string): Promise<MediaStream> {
        try {
            const audioConstraints = deviceId 
                ? { deviceId } 
                : true;

            console.log('Getting media stream with constraints:', audioConstraints);
            
            const stream = await mediaDevices.getUserMedia({
                audio: audioConstraints,
                video: false, // Audio only for this app
            });

            this.mediaStream = stream;
            console.log('Media stream obtained successfully');
            return stream;
        } catch (error) {
            console.error('Error getting media stream:', error);
            throw error;
        }
    }

    /**
     * Switch to a different audio device
     */
    async selectAudioDevice(deviceId: string) {
        const device = this.audioDevices.find((d: any) => d.deviceId === deviceId);
        if (!device) {
            console.warn('Audio device not found:', deviceId);
            return;
        }

        this.selectedAudioDevice = device;
        
        // If we already have a stream, recreate it with the new device
        if (this.mediaStream) {
            const oldStream = this.mediaStream;
            this.mediaStream = await this.getMediaStream(deviceId);
            
            // Stop old tracks
            oldStream.getTracks().forEach(track => track.stop());
        }
    }

    /**
     * Clean up media stream
     */
    cleanup() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = undefined;
        }
    }
}

export const mediaDeviceStore = new MediaDeviceStore();

