const { SR } = require('../Data/data');
var network = require('./mynetwork')
var Graph = require("graphlib");
var Gn    = require("graphlib");
const fs = require('fs');
const { node } = require('@tensorflow/tfjs-node');
class AlgSub{
    constructor(G,nodeDelay,weightArray,rounds, subRounds,numNodes,outDegreeLimit,indegreeLimit) {
        this.G = G;
        this.nodeDelay  = nodeDelay;
        this.weightArray = weightArray;
        this.rounds = rounds;
        this.subRounds = subRounds;
        this.maxLimit = 9999;
        this.maxPathDelay = 2000;
        this.numNodes = numNodes;
        this.outDegreeLimit = outDegreeLimit;     
        this.indegreeLimit = indegreeLimit;  
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
    //optimized broadcasting

    algSub(outDegreeLimit, GraphRet){
        
        let roundPerformanceTable = {}
        
        for(let r = 0 ; r < this.subRounds;++r){
            //roundPerformanceTable[r] = {}
            //So far no special nodes and u have to change this
            let broadCastNode = Math.floor( Math.random()  * (this.numNodes - 1) );
            if(broadCastNode >999){
                console.log(broadCastNode);
            }
            //broadCastNode = r; //remove it from here
            let BlockReciveTable = new Array(this.numNodes).fill(this.maxPathDelay);
            BlockReciveTable[broadCastNode] = 0 ;

            this.broadcastNew(broadCastNode,BlockReciveTable)
            // store the minimum  refrence time for the node i .
            for(let i = 0 ; i<this.numNodes;++i){
                let outEdges = this.G.outEdges(i);
                for(let edge of  outEdges){
                    let LinkDelay = Number(this.G.edge(edge).weight);//Link Delay
                    let nodeDelay = Number(this.nodeDelay[0][edge.w])// neigbours Node Delay
                    let recievingDelay = LinkDelay + nodeDelay + BlockReciveTable[edge.w]; // Neighbours Recieving Delay
                    if(recievingDelay < BlockReciveTable[i]){
                        BlockReciveTable[i] = recievingDelay; // neighbours recieving delay
                    }
                }
            }
            
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
            
        }

        let groups = this.generateSubGroups(this.outDegreeLimit);
         
        for(let i = 0 ; i < this.numNodes ; ++i){
            let groupScores = new Array(groups.length).fill(999999);
            let selectedGroup = 0;
            let selectedScore = 1000001;
            for(let gid = 0 ; gid<groups.length;++gid){
                let subgroup = new Array(this.subRounds).fill(this.maxLimit);
                for(let nid= 0 ; nid<outDegreeLimit;++nid){
                    if(groups[gid][nid] == 1){
                        for(let subR = 0 ; subR<this.subRounds;++subR){
                            let key = i.toString() + nid.toString() + subR.toString();
                            if(Number(subgroup[subR]) > Number(roundPerformanceTable[key]) ){
                                subgroup[subR] = Number(roundPerformanceTable[key] )   
                            }
                        }
                    }
                }
                //90%
                //it  was not sorting properly
               subgroup.sort(function(a, b){return Number(a) - Number(b)})
                groupScores[gid] =   subgroup[this.subRounds*.9]
               if(groupScores[gid] <= selectedScore){
                   selectedScore = groupScores[gid]
                   selectedGroup = gid
               }
            }
            let minScore = Math.min(...groupScores)
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
            let randomNodes = [0,1,2,3,4,5,6,7].filter(value=>!selectedNodeSet.includes(value))
            let nodesToConnect = new Array(2);
             
            //set the selected edges to the new graph 
            for(let j = 0; j<selectedNodeSet.length;j++){
                let edges = this.G.outEdges(i); 
                for(let edge of edges){
                    let edgeWeight = this.G.edge(edge)
                    if(this.G.edge(edge).index == selectedNodeSet[j]){
                        GraphRet.setEdge(edge,edgeWeight);
                        break;
                    }
                }  
            }
            // find the two other nodes other than  the one to be removed;
            for(let j = 0 ; j<2; ++j){ 
                nodesToConnect[j] = this.setRandomConnections(i)
                //increase Incomming limit of the nodesToConnect
                this.G.setEdge(i,nodesToConnect[j],{"index":-1});
            }

            // add the random edges to new graph and let our previous remian unchanged.
            for(let j = 0 ; j<2;++j){
                
                GraphRet.setEdge(i , nodesToConnect[j], {"weight":this.weightArray[i][nodesToConnect[j]] , "index":randomNodes[j]}  )   
      
            }         
            
        }
        return GraphRet;
    }
    // you were changing it in the subround but u have to change the connections after subround;  
    setRandomConnections(node){
       // random is never 1 
        let randNode =  Math.floor(Math.random() * (this.numNodes - 1) )
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

            if(inLimitsize >= this.indegreeLimit){
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
let nodes  = 1000
let [G , delay , weightArray , Gnodes] = network.callNetwork(1,2,nodes,20,8)
let rounds = [0,4,8,16,32,64,128,256,384,512]
for(let i = 0 ; i<=64 ; i++){
    
    console.log(`running the round ${i}\n`)
    if(rounds.includes(i)){
        let graphJson = Graph.json.write(G);
        let  graphName = `../../PerigeeJSHistoricalData/Data/GraphSUB1/GraphFromRound${i}.json`
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
                Gnew.setEdge(edge.w,edge.v,{"weight":weightArray[edge.w][edge.w] , "index":-1})
            }
            
        }
        
        function weight(e) { 
            let i = Number(e.v)
            let j = Number(e.w)
            let nodeWeight1 = Number(delay[0][i])/2
            let nodeWeight2 = Number(delay[0][j])/2
            return Number(Number(weightArray[i][j]) + Number(nodeWeight1) + Number(nodeWeight2) );  
        }
        let allPairShortesPAths = Graph.alg.dijkstraAll(Gnew,weight );
        //let  graphNameShortest = `../../PerigeeJSHistoricalData/Data/SUBSShortestPath1/hash_subsetV1Round${i}.txt`
        let  graphNameShortest = `../hash_subsetV1Round${i}.txt`
        
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
    //delay[0] = new Array(nodes).fill(0)                                      //r nodes sub out
    let GraphRet = new Gn.Graph();
    let graphNodes = G.nodes();
    for(let node of graphNodes){
        GraphRet.setNode(node , G.node(node))
    }
    let alg = new AlgSub(G,delay,weightArray,10,100,nodes,8,20);
    
    GraphRet =  alg.algSub(8,GraphRet);
    let gJson = Graph.json.write(GraphRet); 
    G =  Graph.json.read(gJson);   
}

/*
 G.edge(v,w) gives the weight of the edges v,w

*/