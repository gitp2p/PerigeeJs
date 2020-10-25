const { SR } = require('../Data/data');
var network = require('./network')

class AlgSub{
    constructor(G,nodeDelay,rounds, subRounds,numNodes,outDegreeLimit) {
        this.G = G;
        this.nodeDelay  = nodeDelay
        this.rounds = rounds;
        this.subRounds = subRounds;
        this.maxLimit = 10000;
        this.maxPathDelay = 10000;
        this.numNodes = numNodes
        this.outDegreeLimit = outDegreeLimit
        
    }
    generateSubGroups(outDegreeLimit){
        if(outDegreeLimit==8){
            let groups = [[0,0,1,1,1,1,1,1],[0,1,0,1,1,1,1,1],[0,1,1,0,1,1,1,1],[0,1,1,1,0,1,1,1],[0,1,1,1,1,0,1,1],[0,1,1,1,1,1,0,1],[0,1,1,1,1,1,1,0],[1,0,0,1,1,1,1,1],[1,0,1,0,1,1,1,1],[1,0,1,1,0,1,1,1],[1,0,1,1,1,0,1,1],[1,0,1,1,1,1,0,1],[1,0,1,1,1,1,1,0],[1,1,0,0,1,1,1,1],[1,1,0,1,0,1,1,1],[1,1,0,1,1,0,1,1],[1,1,0,1,1,1,0,1],[1,1,0,1,1,1,1,0],[1,1,1,0,0,1,1,1],[1,1,1,0,1,0,1,1],[1,1,1,0,1,1,0,1],[1,1,1,0,1,1,1,0],[1,1,1,1,0,0,1,1],[1,1,1,1,0,1,0,1],[1,1,1,1,0,1,1,0],[1,1,1,1,1,0,0,1],[1,1,1,1,1,0,1,0],[1,1,1,1,1,1,0,0]]
            return  groups;
        }
        if(outDegreeLimit==6){
            groups = [[0,0,1,1,1,1],[0,1,0,1,1,1],[0,1,1,0,1,1],[0,1,1,1,0,1],[0,1,1,1,1,0],[1,0,0,1,1,1],[1,0,1,0,1,1],[1,0,1,1,0,1],[1,0,1,1,1,0],[1,1,0,0,1,1],[1,1,0,1,0,1],[1,1,0,1,1,0],[1,1,1,0,0,1],[1,1,1,0,1,0],[1,1,1,1,0,0]]
            return groups;
        }
    
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
            let LinkDelay = this.G.edge(out.v,out.w).ew; // edge weight between v , w
            let recievingDelay = LinkDelay + nodeDelay + broadcastTime[out.w]; //time taken to recive from its neigbour
            
            if(recievingDelay < broadcastTime[broadCastNode] ){
                broadcastTime[broadCastNode]  = recievingDelay; // update its broadcasting delay   
            }
        }
        //Hear from its incoming  neighbours.
        for(let innodes of inNodesOFBrodcastNode){
            let nodeDelay = this.nodeDelay[0][innodes.v];
            let LinkDelay = this.G.edge(innodes.v,innodes.w).ew;
            let recievingDelay = LinkDelay + nodeDelay + broadcastTime[innodes.v];
        
            if(recievingDelay < broadcastTime[broadCastNode] ){
                broadcastTime[broadCastNode]  = recievingDelay;   
            }
        }
        let i = 0 ;
        //update will broadcast for outgoing neighbors
        for(let out of OutNodesOFBrodcastNode){
            let nodeDelay = this.nodeDelay[0][out.v]; // node delay of its broadcasting node
            let LinkDelay = this.G.edge(out.v,out.w).ew; // edge weight between v , w
            let sendingDelay = LinkDelay + nodeDelay + broadcastTime[broadCastNode]; //time taken to broadcast to its neigbour
            
            if(sendingDelay < broadcastTime[out.w] ){
                willBroadcastNodes[i++] = out.w ;
                broadcastTime[out.w]  = sendingDelay; // update its broadcasting delay   
            }
        }
        //update will broadcast for incooming neighbors
        for(let innodes of inNodesOFBrodcastNode){
            let nodeDelay = this.nodeDelay[0][broadCastNode];
            let LinkDelay = this.G.edge(innodes.v,innodes.w).ew;
            let sendingDelay = LinkDelay + nodeDelay + broadcastTime[broadCastNode];
            
            if(sendingDelay < broadcastTime[innodes.v] ){
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
    //optimized broadcasting
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
               this.broadcast(willBroadcastNodes[k],broadcastTime)
           }
       }
    }
    algSub(outgoingNeigbours,outDegreeLimit , SubGroups){
        
        let roundPerformanceTable = {}

        for(let r = 0 ; r < this.subRounds;++r){
            //roundPerformanceTable[r] = {}
            //So far no special nodes
            let broadCastNode = Math.floor( Math.random()  * (this.numNodes - 1) );
            if(broadCastNode >999){
                console.log(broadCastNode);
            }
            let BlockReciveTable = new Array(this.numNodes).fill(this.maxPathDelay);
            BlockReciveTable[broadCastNode] = 0 ;

            this.broadcastNew(broadCastNode,BlockReciveTable)
            
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
                //record the time recived of outgoing nodes  
                outKeys.forEach(function(key){
                    //roundPerformanceTable[i][j][r] = {}
                    
                    let v = null;
                    v = OutNodesOFBrodcastNode[key].w;
                    
                    let nodeDelay = self.nodeDelay[0][i];
                    let LinkDelay = G._edgeLabels[key].ew;
                    let sendingDelay = LinkDelay + nodeDelay + BlockReciveTable[i]; //time taken to send a block from node parent to outgoing node.
                    //let rkey = (i.toString()).concat(j.toString).concat(r.toString); 
                    let rkey = i.toString() + j.toString() + r.toString();
                    //Unusuall event condition
                    if(sendingDelay >= BlockReciveTable[v] ){
                        //store the refrenced time of the outgoing node
                        roundPerformanceTable[rkey] = BlockReciveTable[v] + self.nodeDelay[0][v] + G._edgeLabels[key].ew - BlockReciveTable[i];
                    }
                    else{
                        roundPerformanceTable[rkey] = self.maxLimit;
                    }
                    j++;
                });
            }
        }

        let groups = this.generateSubGroups(outDegreeLimit);
         
        for(let i = 0 ; i < this.numNodes ; ++i){
            let groupScores = new Array(groups.length).fill(0);
            let selectedGroup = 0;
            let selectedScore = 1000000000;
            for(let gid = 0 ; gid<groups.length;++gid){
                let subgroup = new Array(this.subRounds).fill(this.maxLimit);
                
                for(let nid= 0 ; nid<outDegreeLimit;++nid){
                    if(groups[gid][nid] == 1){
                            for(let subR = 0 ; subR<this.subRounds;++subR){
                            let key = i.toString() + nid.toString() + subR.toString();
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
            let selectedNodeSet = new Array(outDegreeLimit - 2).fill(0);
            let s = 0 ;
            for(let nid = 0 ; nid<outDegreeLimit;++nid){
                if(groups[selectedGroup][nid] == 1){
                    selectedNodeSet[s] = nid;
                    ++s;   
                }
            }

            //update neighbours
            
            let randomNodes = [0,1,2,3,4,5,6,7].filter(value=>!selectedNodeSet.includes(value)) //not needed 
            let selectedOutNodeSet = new Array(outDegreeLimit-2)
            let outId = 0; // used to indice arrays 
            let outEdgeWeight = new Array(outDegreeLimit - 2)
            let outed = this.G.outEdges(i)
            for(const outNode of selectedNodeSet){
                selectedOutNodeSet[outId] = this.G.outEdges(i)[outNode].w
                outEdgeWeight[outId] = this.G.edge(i,selectedOutNodeSet[outId])
                outId++;
            }

            let nodeData = this.G.node(i)
            //remove the node and incomming edges , out going edges 
            let  inEdges = this.G.inEdges(i)
            let inEdgeWeight = new Array(inEdges.length)
            outId = 0;
            for(let ed of inEdges){
                inEdgeWeight[outId++] = this.G.edge(ed.v,ed.w)
            }
            this.G.removeNode(i);

            this.G.setNode(i , nodeData);

            //add  the edges back  and add the proper weight i.e figure it out later to add original weights
            outId = 0;
            for(const out of selectedOutNodeSet){
                G.setEdge(i, out, outEdgeWeight[outId++] );
            }
            outId = 0;
            //add the incomming edges back to node i and add original weight back;
            for(let inn = 0 ; inn<inEdges.length;++inn){
                G.setEdge(inEdges[inn].v, i, inEdgeWeight[inn] );
            }

            //Add the random edges
            for(const randNode of randomNodes){ 
                this.setRandomConnections(i)
            }
            
        }
    }

    setRandomConnections(node){
       
        let randNode = Math.floor(Math.random() * (this.numNodes - 1));
        let flag = false
        let flag1 = false; // flags for  the conditions
        let flag2 = false;
        let flag3 = false;
        while(true){
            let inLimit = this.G.inEdges(randNode).length 
            if(flag==true){
                this.G.setEdge(node , randNode, {ew:Math.floor(Math.random() * (this.numNodes - 1) ) }  )
                break;
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

            if(inLimit >= this.indegreeLimit){
                flag3 = true;
            }

            if(flag1 ||  flag2 ||  flag3){
                randNode = Math.floor(Math.random() * (this.numNodes - 1) )
                flag1 = flag2 = flag3 = false;
            }
            else{
                flag = true;
            }
          
        }
      
    }
    
}
let [G , delay] = network.callNetwork(1,2,1000,20,8)
for(let i = 0 ; i<100 ; i++){
let alg = new AlgSub(G,delay,10,10,1000,8)


let outE = G.edges()
let sumOut  = 0;
for(o of outE){
    let w = G.edge(o.v,o.w).ew
    sumOut+=w;
}

alg.algSub(null,8,null);
let vw = G.edge(G.outEdges(0)[0].v ,G.outEdges(0)[0].w)

let inE = G.edges()
let sumIn  = 0;
for(o of inE){
    let w = G.edge(o.v,o.w).ew
    sumIn+=w;
}
let diff = sumOut - sumIn
console.log(diff)
}
/*
 G.edge(v,w) gives the weight of the edges v,w

*/