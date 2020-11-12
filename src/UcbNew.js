const { SR } = require('../Data/data');
var network = require('./mynetwork')
var Graph = require("graphlib");
var Gn    = require("graphlib");
const fs = require('fs');
const { math } = require('@tensorflow/tfjs');
class AlgUCB{
    constructor(G,nodeDelay,weightArray,rounds, subRounds,numNodes,outDegreeLimit , delayPercentage,c) {
        this.G = G;
        this.nodeDelay  = nodeDelay;
        this.weightArray = weightArray;
        this.rounds = rounds;
        this.subRounds = subRounds;
        this.maxLimit = 10000;
        this.maxPathDelay = 10000;
        this.numNodes = numNodes;
        this.outDegreeLimit = outDegreeLimit;
        this.delayPercentage = delayPercentage
        this.c = c
    }
    
    //Simple Broadcasting 
    broadcastNew(broadCastNode,broadcastTime){
        let OutNodesOFBrodcastNode = this.G.outEdges(broadCastNode);
        let inNodesOFBrodcastNode = this.G.inEdges(broadCastNode);
        //stores the nodes which to which block will be broadcasted
        let willBroadcastNodes = new Array(OutNodesOFBrodcastNode.length + inNodesOFBrodcastNode.length).fill(-1); 
        
        //Hear from its outgoing neighbours.
        for(let out of OutNodesOFBrodcastNode){
            let nodeDelay = this.nodeDelay[0][out.w]; // node delay of its neighbour
            let LinkDelay = this.G.edge(out.v,out.w).weight; // edge weight between v , w
            let recievingDelay = Number(LinkDelay) + nodeDelay + Number(broadcastTime[out.w]); //time taken to recive from its neigbour
            
            if(recievingDelay < broadcastTime[broadCastNode] ){
                broadcastTime[broadCastNode]  = recievingDelay; // update its broadcasting delay   
            }
        }
        //Hear from its incoming  neighbours.
        for(let innodes of inNodesOFBrodcastNode){
            let nodeDelay = this.nodeDelay[0][innodes.v];
            let LinkDelay = this.G.edge(innodes.v,innodes.w).weight;
            let recievingDelay = Number(LinkDelay) + nodeDelay + Number(broadcastTime[innodes.v]);
        
            if(recievingDelay < Number(broadcastTime[broadCastNode]) ){
                broadcastTime[broadCastNode]  = recievingDelay;   
            }
        }
        let i = 0 ;
        //update will broadcast for outgoing neighbors
        for(let out of OutNodesOFBrodcastNode){
            let nodeDelay = this.nodeDelay[0][out.v]; // node delay of its broadcasting node
            let LinkDelay = this.G.edge(out.v,out.w).weight; // edge weight between v , w
            let sendingDelay = Number(LinkDelay) + nodeDelay + Number(broadcastTime[broadCastNode]); //time taken to broadcast to its neigbour
            let test = broadcastTime[broadCastNode]
            if(sendingDelay < Number(broadcastTime[out.w]) ){
                willBroadcastNodes[i++] = out.w ;
                broadcastTime[out.w]  = sendingDelay; // update its broadcasting delay   
            }
        }
        //update will broadcast for incooming neighbors
        for(let innodes of inNodesOFBrodcastNode){
            let nodeDelay = this.nodeDelay[0][broadCastNode];
            let LinkDelay = this.G.edge(innodes.v,innodes.w).weight;
            let sendingDelay = Number(LinkDelay) + nodeDelay + Number(broadcastTime[broadCastNode]);
            
            if(sendingDelay < Number(broadcastTime[innodes.v]) ){
                willBroadcastNodes[i++] = innodes.v ;
                broadcastTime[innodes.v]  = sendingDelay;   
            }
        }

        for(let k = 0 ;k<i;++k){
            if(willBroadcastNodes[k]!=-1){
                this.broadcastNew(willBroadcastNodes[k],broadcastTime)
            }
        }
    }
    algUcb(historyTable){
        let roundPerformanceTable = {}

        for(let r = 0 ; r < this.subRounds;++r){
            //roundPerformanceTable[r] = {}
            //So far no special nodes
            let broadCastNode = Math.floor( Math.random()  * (this.numNodes - 1) );
            let BlockReciveTable = new Array(this.numNodes).fill(this.maxPathDelay);
            BlockReciveTable[broadCastNode] = 0 ;

            this.broadcastNew(broadCastNode,BlockReciveTable)
            
            for(let i = 0 ; i<this.numNodes;++i){
                let outEdges = this.G.outEdges(i);
                let j = 0;
                for(let edge of  outEdges){
                    let LinkDelay = Number(this.G.edge(edge).weight);
                    let nodeDelay = Number(this.nodeDelay[0][i]) //i's delay
                    let sendingDelay = LinkDelay + nodeDelay + BlockReciveTable[i];
                    let rkey = i.toString() + j.toString() + r.toString();
                    let reftime = BlockReciveTable[edge.w] + nodeDelay + LinkDelay - BlockReciveTable[i];
                    //if neighbour's recieving is > the time of node[i] sending it then its an unfortunate event
                    if(BlockReciveTable[edge.w] <= sendingDelay){
                        roundPerformanceTable[rkey] = Number(BlockReciveTable[edge.w]) + Number(this.nodeDelay[0][edge.w]) + LinkDelay - Number(BlockReciveTable[i]);
                    }
                    else{
                        roundPerformanceTable[rkey] = this.maxLimit
                    }
                    ++j;
                }
                
            }
            let lowerBoundTable = new Array(this.numNodes).fill(0);
            let upperBoundTable = new Array(this.numNodes).fill(0);
            
            for(let i = 0 ; i < this.numNodes;++i){
                let edges = this.G.outEdges(i)
                lowerBoundTable[i] = new Array()
                upperBoundTable[i] = new Array()
                for(let j=0 ; j<this.outDegreeLimit;++j){
                    //key is your edge
                    let key = `${i}${this.G.edge(edges[j]).index}`
                    if(!historyTable[key]){
                        historyTable[key] = new Array();
                    }
                    historyTable[key].push( roundPerformanceTable[`${key}${r}`]);
                    historyTable[key].sort(function(a, b){return Number(a) - Number(b)});
                    let len = historyTable[key].length
                    let value = historyTable[key][Math.floor(this.delayPercentage*len)];
                    let bound = this.c*Math.sqrt(Math.log(this.subRounds)/(2*len) );
                    let upBound = value  + bound;
                    let lowBound = value - bound;
                    //store in the proper location later i can remove it with ease
                    upperBoundTable[i][this.G.edge(edges[j]).index] = upBound;
                    lowerBoundTable[i][this.G.edge(edges[j]).index] = lowBound;
                }

                let min_upper  = Math.min(...upperBoundTable[i])
                let max_lower  = Math.max(...lowerBoundTable[i])
                //switch a node to  the random node 
                if(min_upper < max_lower){
                    // caution here check it again if you are delting the right key
                    let nodeToChange =   lowerBoundTable[i].findIndex(val=>val===max_lower)
                    let switchKey = `${i}${nodeToChange}`
                    // delete the nodes history and let it start fresh
                    historyTable[switchKey].splice(0,historyTable[switchKey].length);
                    let w = this.G.edge(this.G.outEdges(i)[nodeToChange])
                    let randNode = this.setRandomConnections(i,this.G)
                    //remove the unwanted edge and set the new edge
                    let outEdges = this.G.outEdges(i);
                    for(let edge of outEdges){
                        if(this.G.edge(edge).index==nodeToChange){
                            this.G.removeEdge(edge);
                            this.G.setEdge(i,randNode,{"weight" : weightArray[i][randNode], "index":nodeToChange})
                            break;
                        }
                    }     
                }    
            }
        }
        return historyTable
    }
    // update after round need to change this.
    setRandomConnections(node){
        // random is never 1 
         let randNode =  Math.floor(Math.random() * (this.numNodes -1 ) )
         let flag = false
         let flag1 = false; // flags for  the conditions
         let flag2 = false;
         let flag3 = false;
        Object.size = function(obj) {
             var size = 0, key;
             for (key in obj) {
                 if (obj.hasOwnProperty(key)) size++;
             }
             return size;
        };
         
        while(true){
            let inLimitsize = this.G.inEdges(randNode).length
             // let  = inLimit.length//Object.size(inLimit);
            if(flag==true){
                return randNode;
            }
           
            let outlist = this.G.outEdges(node)
            for(let k = 0 ; k < outlist.length; ++k){
                if(outlist[k].w == randNode){
                    flag1 = true;
                }
            }
 
            if(randNode == node){
                 flag2=true;
            }
 
            if(inLimitsize >= 20){
                 flag3 = true;
            }
 
            if(flag1 ||  flag2 ||  flag3){
                randNode = Math.floor(Math.random() * (this.numNodes -1) )
                flag1 = flag2 = flag3 = false;
            }
            else{
                flag = true;
            }
           
         }
       
    }
    
}
let nodes  = 1000
let [G , delay , weightArray] = network.callNetwork(1,2,nodes,20,8)
let rounds = [0,4,8,16,32,64,128,256,384,512]
for(let i = 0 ; i<=128 ; i++){
    console.log(`running the round ${i}\n`)
    if(rounds.includes(i)){
        let graphJson = Graph.json.write(G);
        let  graphName = `../../PerigeeJSHistoricalData/Data/GraphUCB/UCBGraphFromRound${i}.json`
        fs.writeFile(graphName, JSON.stringify(graphJson), (err) => {
            if (err) {
                throw err;
            }
            console.log("JSON data is saved.");
        });

        let Gnew = Graph.json.read(graphJson)
        for(let node = 0 ; node<nodes; ++node){
            let inList = Gnew.inEdges(node)
            for(let edge of inList){
                //console.log(edge)
                Gnew.setEdge(edge.w,edge.v)
            }
            
        }
        function weight(e) { 
            let i = Number(e.v)
            let j = Number(e.w)
            let nodeWeight1 = Number(delay[0][i])/2
            let nodeWeight2 = Number(delay[0][j])/2
            return Number(Number(weightArray[i][j]) + nodeWeight1 + nodeWeight2);  
        }
        let allPairShortesPAths = Graph.alg.dijkstraAll(Gnew,weight );
        //let  graphNameShortest = `../../PerigeeJSHistoricalData/Data/UCBShortesPath/hash_ucbV1Round${i}.txt`
        let  graphNameShortest = `../hash_ucbV1Round${i}.txt`
        //let allPairShortesPAthsJSON = JSON.parse(allPairShortesPAths);
        let distances = '';
        for(let i = 0 ;i<nodes;++i){
            
            for(let j =0 ; j<nodes;++j){
                let tem = allPairShortesPAths[i][j]["distance"];
                distances = distances.concat(`${allPairShortesPAths[i][j]["distance"]}  `)
            }
            distances = distances.concat("\n")
        }
        fs.writeFile(graphNameShortest, distances, (err) => {
            if (err) {
                throw err;
            }
            console.log("JSON data is saved.");
        });
    }
 
    let alg = new AlgUCB(G,delay,weightArray,100,100,nodes,8,.9,130)
    let historyTable = {}
    historyTable = alg.algUcb(historyTable);      
}

/*
 G.edge(v,w) gives the weight of the edges v,w

*/