import { types } from "mediasoup";
import { Server, Socket } from "socket.io";
import { config } from "./config";

export class Peer {

    id: string;
    name: string;
    transports = new Map();
    producerTransports = new Map();
    consumerTransports = new Map();


    constructor(socketId: string, name: string) {
        this.id = socketId;
        this.name = name;
        console.log("created peer with id: ", socketId);
    }


    addTransport(transport: types.Transport) {
        this.transports.set(transport.id, transport);

    }

    connectPeerTransport(dtlsParameters: types.DtlsParameters, transportId: string) {
        if (!this.transports.has(transportId)) return;
        this.transports.get(transportId).connect({ dtlsParameters });

    }

    async createProducer(rtpParameter: types.RtpParameters, kind: types.MediaKind, transportId: string) {
        try {

            const transport: types.Transport = this.transports.get(transportId);

            const producerTransport = await transport.produce({ rtpParameters: rtpParameter, kind, paused: false });
            this.producerTransports.set(producerTransport.id, producerTransport);
            return producerTransport;

        } catch (error: any) {
            console.log(error.message);

        }

    }

    async consume(rtpCapabilities: types.RtpCapabilities, transportId: string, producerId: string) {
        const consTransport: types.Transport = this.transports.get(transportId);


        const consumer = await consTransport.consume({ producerId, rtpCapabilities, paused: false });
        this.consumerTransports.set(consumer.id, consumer);
        const params = {
            id: consumer.id,
            producerId: producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
            name: this.name,
            isPuased: consumer.paused
        }
        if (consumer.type === 'simulcast') {
            await consumer.setPreferredLayers({
                spatialLayer: 2,
                temporalLayer: 2
            })
        }
        
        return (params);


    }

    async resumeConsumer(transportId:string){
        const consumer  = this.consumerTransports.get(transportId);
        await consumer.resume();
        return({success:true});

    }



}