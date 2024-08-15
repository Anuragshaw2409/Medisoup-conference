import { types } from "mediasoup";
import { Peer } from "./Peer";
import { Server } from "socket.io";

export class Room {
    peerList = new Map();
    worker: types.Worker;
    id: string;
    router!: types.Router
    io:Server


    constructor(worker: types.Worker, id: string, io:Server) {
        this.id = id;
        this.worker = worker;
        this.io = io;
        worker.createRouter({
            mediaCodecs: [
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                },
                {
                    kind: 'video',
                    mimeType: 'video/VP8',
                    clockRate: 90000,
                    parameters: {
                        'x-google-start-bitrate': 1000,
                    },
                },
            ]
        })
            .then((router) => {
                this.router = router;
            })
            .catch((err) => {
                console.log("Error occured while creating router: ", err);
            });
    }

    addPeer(socketId: string, name: string, isAdmin:boolean) {
        try {
            const peer = new Peer(socketId, name, isAdmin);
            this.peerList.set(socketId, peer);
            return ({ success: true, message: `Socket: ${name}:${socketId}, added to room: ${this.id}`, roomId: this.id });
        } catch (error: any) {
            return ({ success: false, message: `error adding peer ${error.message}` });
        }


    }

    getRtpCapbailities() {
        return this.router.rtpCapabilities;
    }

    getProducers(socketId: string) {
        let producers: string[] = [];

        this.peerList.forEach((peer) => {
            if (peer.id !== socketId) {
                // Assuming peer.producers is a Map or an array-like structure
                peer.producers.forEach((prod: any) => {
                    producers.push(prod.id);
                });
            }
        });

        return producers;
    }


    async createTransport(socketId: string) {

        try {
            const transport = await this.router.createWebRtcTransport(this.webRtcTransport_options);
            const success = this.peerList.get(socketId).addTransport(transport);
            if (success) {
                return ({
                    success: true, message: "Producer Transport added", params: {
                        id: transport.id,
                        iceParameters: transport.iceParameters,
                        iceCandidates: transport.iceCandidates,
                        dtlsParameters: transport.dtlsParameters
                    }
                });
            }
            else {
                throw new Error("Transport not added");
            }
        } catch (error) {
            return ({ success: false, message: "Transport cannot be added", error: error });

        }

    }

    async connectPeerTransport(socketId: string, transportId: string, dtlsParameters: types.DtlsParameters) {
        const response = await this.peerList.get(socketId).connectTransport(transportId, dtlsParameters);

        return response;

    }


    async produce(transportId: string, rtpParameters: types.RtpParameters, kind: types.MediaKind, socketId: string) {

        const response = await this.peerList.get(socketId).produce(transportId, rtpParameters, kind);
        if(response.success){
        this.broadcast(socketId, response.producerId)}
        return response;

    }


    async consume(transportId:string, rtpCapabilities:types.RtpCapabilities,producerId:string, socketId:string){

        if(!this.router.canConsume({producerId:producerId, rtpCapabilities:rtpCapabilities,}))
            return ({success:false, message:"Cannot consume Producer"});

        const name = this.getNameOfProducer(producerId);
        console.log(this.peerList.keys());
        
        let response = await this.peerList.get(socketId).consume(transportId, rtpCapabilities, producerId, name);        

        return response;


    }


    getNameOfProducer(producerId:string){
        let foundName = "";

        this.peerList.forEach((peer)=>{
            const name = peer.isproducerAvailable(producerId);
            
            if(name!= undefined){
                foundName = name;
                return;
            } 
        })
        return foundName;


    }

    broadcast(socketId:string, producerId:string){
        this.peerList.forEach((peer) => {
            if(peer.id != socketId){
                console.log("Emited once");
                
                this.io.to(peer.id).emit('new-producer',{producerId});
            }
        });

    }




















    webRtcTransport_options = {
        listenIps: [
            {
                ip: '0.0.0.0', // replace with relevant IP address
                announcedIp: '127.0.0.1',
            }
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
    }


}