const { SR } = require('../Data/data');
var network = require('./network')

class AlgSub{
    constructor(G,nodeDelay,rounds, subRounds,numNodes) {
        this.G = G;
        this.nodeDelay  = nodeDelay
        this.rounds = rounds;
        this.subRounds = subRounds;
        this.maxLimit = 10000;
        this.maxPathDelay = 2000;
        this.numNodes = numNodes
        
    }
    generateSubGroups(){
        if(this.outDegreeLimit==8){
            groups = [[0,0,1,1,1,1,1,1],[0,1,0,1,1,1,1,1],[0,1,1,0,1,1,1,1],[0,1,1,1,0,1,1,1],[0,1,1,1,1,0,1,1],[0,1,1,1,1,1,0,1],[0,1,1,1,1,1,1,0],[1,0,0,1,1,1,1,1],[1,0,1,0,1,1,1,1],[1,0,1,1,0,1,1,1],[1,0,1,1,1,0,1,1],[1,0,1,1,1,1,0,1],[1,0,1,1,1,1,1,0],[1,1,0,0,1,1,1,1],[1,1,0,1,0,1,1,1],[1,1,0,1,1,0,1,1],[1,1,0,1,1,1,0,1],[1,1,0,1,1,1,1,0],[1,1,1,0,0,1,1,1],[1,1,1,0,1,0,1,1],[1,1,1,0,1,1,0,1],[1,1,1,0,1,1,1,0],[1,1,1,1,0,0,1,1],[1,1,1,1,0,1,0,1],[1,1,1,1,0,1,1,0],[1,1,1,1,1,0,0,1],[1,1,1,1,1,0,1,0],[1,1,1,1,1,1,0,0]]
            return  groups;
        }
        if(this.outDegreeLimit==6){
            groups = [[0,0,1,1,1,1],[0,1,0,1,1,1],[0,1,1,0,1,1],[0,1,1,1,0,1],[0,1,1,1,1,0],[1,0,0,1,1,1],[1,0,1,0,1,1],[1,0,1,1,0,1],[1,0,1,1,1,0],[1,1,0,0,1,1],[1,1,0,1,0,1],[1,1,0,1,1,0],[1,1,1,0,0,1],[1,1,1,0,1,0],[1,1,1,1,0,0]]
            return groups;
        }
    
    }
    broadcast(broadCastNode,broadcastTime){
       let OutNodesOFBrodcastNode = this.G._out[broadCastNode];
       let inNodesOFBrodcastNode = this.G._in[broadCastNode];
 
       let outKeys = Object.keys(this.G._out[broadCastNode]);
       let inKeys  = Object.keys(this.G._in[broadCastNode]);
       let keys = outKeys.concat(inKeys);
       let outLen = outKeys.length;
       let inLen = inKeys.length;
       let willBroadcastNodes = new Array(outLen + inLen).fill(0); 
       let i = 0 ;
       //broadcasting from its neigbours
       let self = this;
       keys.forEach(function(key){
        let v = null;
        if(outLen !=0 ){
            v = OutNodesOFBrodcastNode[key].w;
            outLen--;
        }
        else{
            v = inNodesOFBrodcastNode[key].v;
        }
        
        let nodeDelay = self.nodeDelay[0][v];
        let LinkDelay = self.G._edgeLabels[key].ew;
        let recievingDelay = LinkDelay + nodeDelay + broadcastTime[v]; 
        
        if(recievingDelay < broadcastTime[broadCastNode] ){
            broadcastTime[broadCastNode]  = recievingDelay;   
        }
       });

       //Nodes to be broadcasted
       outLen = outKeys.length;
       keys.forEach(function(key){
        let v = null;
        if(outLen !=0 ){
            v = OutNodesOFBrodcastNode[key].w;
            outLen--;
        }
        else{
            v = inNodesOFBrodcastNode[key].v;
        }
        
        let nodeDelay = self.nodeDelay[0][broadCastNode];
        let LinkDelay = self.G._edgeLabels[key].ew;
        let sendingDelay = LinkDelay + nodeDelay + broadcastTime[broadCastNode]; 
        
        if(sendingDelay< broadcastTime[v] ){
            willBroadcastNodes[i++] = v ;
            broadcastTime[v]  = sendingDelay;   
        }
       });

       for(let k = 0 ;k<i;++k){
           if(willBroadcastNodes[k]!=0){
               this.broadcast(willBroadcastNodes[k],G,broadcastTime)
           }
       }
    }
    algSub(outgoingNeigbours,outDegreeLimit , SubGroups){
        //So far no special nodes
        let broadCastNode = Math.floor(Math.random() * (this.numNodes - 1));

        let roundPerformanceTable = {}

        for(let r = 0 ; r < this.subRounds;++r){
            //roundPerformanceTable[r] = {}
            let BlockReciveTable = new Array(this.numNodes).fill(this.maxPathDelay);
            BlockReciveTable[broadCastNode] = 0 ;
            //Calculate broadcast recieving time of nodes 
            this.broadcast(broadCastNode,BlockReciveTable)
            
            //set  Block recieving time = min (time for blocks recieved from  its neighbours)
            
            for(let i = 0 ; i< this.numNodes;++i){
                //roundPerformanceTable[i][r] = {}
                let OutNodesOFBrodcastNode = G._out[i];
                let inNodesOFBrodcastNode = G._in[i];
                let outKeys = Object.keys(G._out[i]);
                let inKeys  = Object.keys(G._in[i]);
                let keys = outKeys.concat(inKeys);
                let outLen = outKeys.length;
                let inLen = inKeys.length;
                let self = this;
                keys.forEach(function(key){
                    
                    let v = null;
                    if(outLen !=0 ){
                        v = OutNodesOFBrodcastNode[key].w;
                        outLen--;
                    }
                    else{
                        v = inNodesOFBrodcastNode[key].v;
                    }
                    
                    let nodeDelay = self.nodeDelay[0][v];
                    let LinkDelay = G._edgeLabels[key].ew;
                    let recievingDelay = LinkDelay + nodeDelay + BlockReciveTable[v]; 
                    
                    if(recievingDelay < BlockReciveTable[i] ){
                        BlockReciveTable[i]  = recievingDelay;   
                    }
                });
                let j = 0 ;
                //record the time recived 
                outKeys.forEach(function(key){
                    //roundPerformanceTable[i][j][r] = {}
                    
                    let v = null;
                    v = OutNodesOFBrodcastNode[key].w;
                    
                    let nodeDelay = self.nodeDelay[0][i];
                    let LinkDelay = G._edgeLabels[key].ew;
                    let sendingDelay = LinkDelay + nodeDelay + BlockReciveTable[i]; 
                    //let rkey = (i.toString()).concat(j.toString).concat(r.toString); 
                    let rkey = i.toString() + j.toString() + r.toString();
                    if(sendingDelay >= BlockReciveTable[v] ){
                        
                        roundPerformanceTable[rkey] = BlockReciveTable[v] + self.nodeDelay[0][v] + G._edgeLabels[key].ew - BlockReciveTable[i];
                    }
                    else{
                        roundPerformanceTable[rkey] = self.maxLimit;
                    }
                    j++;
                });
            }
        }

        let groups = this.generateSubGroups();
         
        for(let i = 0 ; i < this.numNodes ; ++i){
            let groupScores = new Array(groups.length).fill(0);
            let selectedGroup = 0;
            let selectedScore = 1000000000;
            for(let gid = 0 ; j<groups.length;++gid){
                let subgroup = new Array(this.subRounds).fill(this.maxLimit);
                
                for(let nid= 0 ; nid<this.outDegreeLimit;++i){
                    if(groupScores[gid][nid] == 1){
                            for(let subR = 0 ; subR<this.subRounds;++subR){
                            let key = i.toString() + nid.toString() + this.subR.toString();
                            if(subgroup[subR] > roundPerformanceTable[key] ){
                                subgroup[subR] = roundPerformanceTable[key]    
                            }
                        }
                    }
                }
                //90%
               groupScores[gid] =   subgroup.sort()[this.subRounds*.9]
               if(groupScores[gid] < selectedScore){
                   selectedScore = groupScores[gid]
                   selectedGroup = gid
               }
            }
            //computed the nodeset to which a node will connect
            let selectedNodeSet = new Array(this.outDegreeLimit - 2).fill(0);
            let s = 0 ;
            for(let nid = 0 ; nid<this.outDegreeLimit;++nid){
                if(groups[selectedGroup][nid] == 1){
                    selectedNodeSet[s] = nid;
                    ++s;   
                }
            }

            //update neighbours
            
            

        }
    }

}
let [G , delay] = network.callNetwork(1,2,1000,20,8)
let alg = new AlgSub(G,delay ,10,100,1000)

alg.algSub(null,8,null);
let a = 9;