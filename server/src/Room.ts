import { types } from "mediasoup";
import { Server, Socket } from "socket.io";
import { config } from "./config";
import { Peer } from "./Peer";
import { IceCandidate } from "mediasoup/node/lib/fbs/web-rtc-transport";


export class Room{
    
    worker:types.Worker;
    io:Server;
    id:string;
    router?:types.Router;
    PeerList = new Map();


    constructor(worker:types.Worker, io:Server, roomId:string){
        this.worker = worker;
        this.io = io;
        this.id = roomId;
        const mediaCodecs = config.mediasoup.router.mediaCodecs
        worker.createRouter({mediaCodecs})
        .then((router)=>{
            this.router = router
        })
        .catch((err)=>{
            console.log("error creating router");
            process.exit(1);
        })

        console.log("created room with room id: ",roomId);
    }


    addPeer(socketId:string, name:string){
        this.PeerList.set(socketId, new Peer(socketId, name));

    }

    getRTPCapabilities(){
        return this.router?.rtpCapabilities;
    }



    async createTransport(socketId:string){

        const transport = await this.router?.createWebRtcTransport({
            listenIps: [
                {
                  ip: '0.0.0.0', // replace with relevant IP address
                  announcedIp: '127.0.0.1',
                }
              ],
              enableUdp: true,
              enableTcp: true,
              preferUdp: true,
              initialAvailableOutgoingBitrate: 1000000
        })
        try {
            await transport?.setMaxIncomingBitrate(1500000);
        } catch (error) {
            
        }

        this.PeerList.get(socketId).addTransport(transport);
        const params = {
            id: transport?.id,
            iceCandidates:transport?.iceCandidates,
            iceParameters:transport?.iceParameters,
            dtlsParameters: transport?.dtlsParameters,
            sctpParameters: transport?.sctpParameters
        }
        return params;
    }



    connectPeerTransport(dtlsParameters:types.DtlsParameters, transportId:string, socketId:string){
    
        this.PeerList.get(socketId).connectPeerTransport(dtlsParameters, transportId);


    }

    async produce(rtpParameter:types.RtpParameters, kind:types.MediaKind, transportId:string, socketId:string){
        if(!this.PeerList.get(socketId).transports.has(transportId))return;

        const producer = await this.PeerList.get(socketId).createProducer(rtpParameter, kind, transportId);
        //broadcast to everyone in the room about new producer and send them producer id


        return producer;
    }

    async consume(rtpCapabilities:types.RtpCapabilities,producerId:string, transportId:string, socketId:string){
        if(!this.PeerList.get(socketId).transports.has(transportId)){
            console.log("Does not have transport id", transportId);
            
            return;
}
        if(!this.router?.canConsume({producerId, rtpCapabilities})){
            console.log("Cannot consume");
            return ;
}
        const params = this.PeerList.get(socketId).consume(rtpCapabilities,transportId, producerId);
       
        return (params);


    }
    consumerResume(socketId:string, transportId:string){
        if(!this.PeerList.get(socketId).consumerTransports.has(transportId)){
            return({success:false})
            
        }
        const {success} = this.PeerList.get(socketId).resumeConsumer(transportId);
        return ({success});
    }   

    getAllproducers(socketId:string){
        let producersList:string[] = [];
        this.PeerList.forEach((peer)=>{
            if(peer.id!=socketId)
            peer.producerTransports.forEach((transport:any)=>{
                producersList.push(transport.id);
            })
        });
        return producersList;

    }


    hasPeer(socketId:string){
        if(this.PeerList.has(socketId))
            return true;
        return false;
    }

   
}