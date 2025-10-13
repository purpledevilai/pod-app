import { makeAutoObservable } from "mobx";

class MediaDeviceStore {

    videoDevices: MediaDeviceInfo[] = [];
    audioDevices: MediaDeviceInfo[] = [];
    selectedVideoDevice: MediaDeviceInfo | undefined = undefined;
    selectedAudioDevice: MediaDeviceInfo | undefined = undefined;
    mediaStream: MediaStream | undefined = undefined;

    constructor() {
        makeAutoObservable(this);
    }

    initializeMediaDevices = async () => {
        // Prompt for both video and audio
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // Get all the devices
        const devices = await navigator.mediaDevices.enumerateDevices();

        // Separate video and audio devices
        this.videoDevices = devices.filter((d) => d.kind === "videoinput");
        this.audioDevices = devices.filter((d) => d.kind === "audioinput");

    }
}

export const mediaDeviceStore = new MediaDeviceStore();