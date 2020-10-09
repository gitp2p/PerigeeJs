var Graph = require("graphlib").Graph;
let tf = require('@tensorflow/tfjs-node')
var fs    = require('fs')
const con = require('../Data/data')
const bitNodes = require('../Data/bitnodes.json')
function Network(filedelay , networkType,numNodes,indegreeLimit,outDegree){
  this.filedelay = filedelay;
  this.networkType = networkType;
  this.numNodes = numNodes;
  this.indegreeLimit = indegreeLimit
  this.outDegreeLimit = outDegree
  this.G;
  //to do
  //randomly sample x nodes and build graph on that
  this.setNodesofGraph = function (){
    G = new Graph();
    this.G = G
    nodes = bitNodes["nodes"];
    let i = 0;
    m = 0

    for(let key in nodes){
      if(con[nodes[key][7]] != 'Null'){
        label = nodes[key][7]
        G.setNode(i, {
          country:label,
          cluster:con[label]
        } );
        ++i;
      }

    }
    return G;
    console.log(G._nodeCount)
  }


  this.setNodeDelay = function(){
    return new Array(tf.randomNormal([this.numNodes],5,4.5).dataSync() ) 
  }

  this.Nodebandwith = function(){

  }

  //It contains the neighbours a node including the incomming and outgoing
  this.totalNeighbours = function(outgoingNeighbours){
    let allNeighbours = new Array(this.numNodes)
    for(let  i = 0 ; i<this.numNodes;++i ){
      allNeighbours[i] = {}
      allNeighbours[i]['size'] = this.outDegreeLimit;
      for(let j = 0 ; j<this.outDegreeLimit;++j ){
        allNeighbours[i][j] = outgoingNeighbours[i][j];
        
      }
    }

    for(let i=0 ; i<this.numNodes;++i){
      let outNeigboursI = Object.values(allNeighbours[i]);
      outNeigboursI.forEach(function(j){
        outNeigboursJ = allNeighbours[j]
        if( !Object.values(outNeigboursJ).includes(i)){
          allNeighbours[j][allNeighbours[j]["size"]] = i;
          allNeighbours[j]["size"]+=1;
        }
      });

    }

    return allNeighbours;

  }
  /*check if  outgoing neighbour is already set 
      or 
    outgoing neighbour is not the node itself
      or
    incomming limit of the outgoing node doesnt exceed 
    if above conditions are met then repeat until we find a node such that 
    these are coditions are not voilated.*/
  this.setRandomConnection = function(outDegree){
    let outgoingNeighbours = new Array(this.numNodes)
    
    let incommingNodeLimit = new Array(this.numNodes).fill(0)
    
    for(let i = 0  ; i<this.numNodes;++i){
      outgoingNeighbours[i] = {}
    	for(let j = 0 ; j<outDegree;++j){
        outgoingNeighbours[i][j] = Math.floor(Math.random() * (this.numNodes - 1));
        let flag = false
        let flag1 = false; // flags for  the conditions
        let flag2 = false;
        let flag3 = false;
        while(true){
          let out = outgoingNeighbours[i][j];
          if(flag==true){
            incommingNodeLimit[out] ++;
            break;
          }
          
          let outlist = outgoingNeighbours[i]
          for(let k = 0 ; k < j; ++k){
              if(outlist[k] == out){
                flag1 = true;
              }
            }

          if(out == i){
            flag2=true;
          }

          if(incommingNodeLimit[out] > this.indegreeLimit){
            flag3 = true;
          }

          if(flag1 ||  flag2 ||  flag3){
            outgoingNeighbours[i][j] = Math.floor(Math.random() * (this.numNodes - 1) )
            flag1 = flag2 = flag3 = false;
          }
          else{
            flag = true;
          }
          
        }
      }
    }

    return [outgoingNeighbours,incommingNodeLimit]
  }
  //set Graph edges
  this.setWeightedEdges = function(G,outgoingNeighbours,delay){
    for(let i = 0 ; i < this.numNodes ; ++i){
      for(let j = 0 ; j<this.outDegreeLimit;++j){
        G.setEdge(i, outgoingNeighbours[i][j], {"ew":Math.floor(Math.random() * (this.numNodes - 1) ) , "nw":Math.floor(delay[0][i])} );

      }
    }
    let a = G._in
    let g = Object.keys(a[0])
    let m = a[0][g[0]].v
    return G;
  }

  
}


function callNetwork(filedelay , networkType,numNodes,indegreeLimit,outDegree){
obj = new Network(filedelay , networkType,numNodes,indegreeLimit,outDegree)
G = obj.setNodesofGraph()
//obj.setNodesofGraph("data1.json")
const  [outgoingNeighbours,incommingNodeLimit] = obj.setRandomConnection(4)
let delay = obj.setNodeDelay()
//obj.totalNeighbours(outgoingNeighbours)
G = obj.setWeightedEdges(G,outgoingNeighbours,delay)
return [G , delay] ;
}

exports.callNetwork = callNetwork;