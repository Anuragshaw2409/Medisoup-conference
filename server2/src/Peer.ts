import { types } from "mediasoup";

export class Peer {
    name: string;
    id: string;
    isAdmin:boolean;
    transports = new Map();
    producers = new Map();
    consumers = new Map();

    constructor(id: string, name: string,  isAdmin:boolean) {
        this.id = id;
        this.name = name;
        this.isAdmin = isAdmin;

        console.log("IsAdmin: ", isAdmin);
        
    }

    addTransport(transport: types.Transport) {
        try {
            this.transports.set(transport.id, transport);
            return true;

        } catch (error) {
            return false;
        }

    }

    async connectTransport(transportId: string, dtlsParameters: types.DtlsParameters) {
        const transport = this.transports.get(transportId);
        if (!transport) {
            return ({ success: false, message: "transport does not exists", place:"connect transport", id:transportId });
        }

        try {
            await transport.connect({
                dtlsParameters: dtlsParameters
            });
            return ({ success: true, message: "transport connected" });

        } catch (error) {

            return ({ success: false, message: "Error conecting transport", error });

        }

    }




    async produce(transportId: string, rtpParameters: types.RtpParameters, kind: types.MediaKind) {
        const transport: types.Transport = this.transports.get(transportId);
        if (!transport) {
            return ({ success: false, message: "transport does not exists" });
        }

        try {
            const producer = await transport.produce({
                rtpParameters: rtpParameters,
                kind: kind,
                paused:false
            });
            this.producers.set(producer.id, producer);
            producer.on('transportclose', ()=>{
                console.log("producer Transport closed ",this.name);
                this.producers.delete(producer.id);
                
            })

            return ({ success: true, message: "Producer created", producerId: producer.id });

        } catch (error) {

            return ({ success: false, message: "Error creating producer", error });
        }



    }




    async consume(transportId:string, rtpCapabilities:types.RtpCapabilities, producerId:string, name:string){
        const transport: types.Transport = this.transports.get(transportId);
        if (!transport) {
            return ({ success: false, message: "transport does not exists" });
        }

        try {
           const consumer = await transport.consume({
            producerId:producerId,
            rtpCapabilities: rtpCapabilities,
            paused:false
           });
           this.consumers.set(consumer.id, consumer);
           return ({success:true, params:
            {producerId: producerId,
            id: consumer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
            producerPaused: consumer.producerPaused,
            name:name}});

            consumer.on('transportclose', ()=>{
                console.log("Consumer transport closed",consumer.id);
                this.consumers.delete(consumer.id);
            })



        } catch (error) {
            return ({ success: false, message: "Error creating consumer", error });
            
        }



    }

    isproducerAvailable(producerId:string){
       
        if(this.producers.has(producerId)){
            const name:string = this.name;
        console.log("Name in funcPeer: ",this.name);
         return name;
        }
    }


}