var Graph = require("graphlib").Graph;
let tf = require('@tensorflow/tfjs-node')
var fs    = require('fs')
const con = require('../Data/data')
const bitNodes = require('../Data/bitnodes.json')
const delayJson = require('../Data/delays.json');
const { count } = require("console");
function Network(filedelay , networkType,numNodes,indegreeLimit,outDegree){
  this.filedelay = filedelay;
  this.networkType = networkType;
  this.numNodes = numNodes;
  this.indegreeLimit = indegreeLimit
  this.outDegreeLimit = outDegree
  this.G;
  //to do
  //randomly sample x nodes and build graph on that
  this.setNodesofGraph = function (nodes){
    G = new Graph();
    this.G = G
    /*
    nodes = bitNodes["nodes"];
    let i = 0;
    m = 0
    //change here
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
    */
   let i = 0;
    for(let node of nodes){
      G.setNode(i,node)
      ++i
    }
    return G;
  }


  this.setNodeDelay = function(){
    return new Array(tf.randomNormal([this.numNodes],20,5).dataSync() ) 
  }

  this.Nodebandwith = function(){

  }
  /*check if  outgoing neighbour is already set 
      or 
    outgoing neighbour is not the node itself
      or
    incomming limit of the outgoing node doesnt exceed 
    if above conditions are met then repeat until we find a node such that 
    these are coditions are not voilated.*/
  this.setRandomConnection = function(){
    let outgoingNeighbours = new Array(this.numNodes)
    
    let incommingNodeLimit = new Array(this.numNodes).fill(0)
    
    for(let i = 0  ; i<this.numNodes;++i){
      outgoingNeighbours[i] = {}
    	for(let j = 0 ; j<this.outDegreeLimit;++j){
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
  this.setWeightedEdges = function(G,outgoingNeighbours,delay,edgeWeights){
    let countries = ["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","CW","KM","CG","CD","CK","CR","CI","HR","CU","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MK","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","AN","NC","NZ","NI","NE","NG","NU","NF","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","SH","KN","LC","PM","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW"]
    let notEdges = 0;

    for(let i = 0 ; i < this.numNodes ; ++i){
      let v = G.node(i.toString())
      for(let j = 0 ; j<this.outDegreeLimit;++j){
        // Get the label for node b g.node("b");
        let u = G.node(outgoingNeighbours[i][j].toString())
        // key is the country-country .   edgeWeights[key] contains the array of weights 
        let key = `${v}-${u}`
        
        try{
          let weights = edgeWeights[key]
          let randWeight = weights[Math.floor(Math.random() * weights.length)] 
          G.setEdge(i, outgoingNeighbours[i][j], {ew:randWeight} );
          
        }
        catch{
          let countries1 = [...countries]
          while(true){
            
            let vnew = countries1[Math.floor(Math.random() * countries1.length)]
            const index = countries1.indexOf(vnew);
            if (index > -1) {
              countries1.splice(index, 1);
            }
            let key = `${v}-${vnew.toLowerCase()}`
            let key1 = `${vnew.toLowerCase()}-${v}`
            if(edgeWeights[key]){
              let weights = edgeWeights[key]
              let randWeight = weights[Math.floor(Math.random() * weights.length)] 
              G.setEdge(i, outgoingNeighbours[i][j], {ew:randWeight} );
              break;
            }
            if(edgeWeights[key1]){
              let weights = edgeWeights[key1]
              let randWeight = weights[Math.floor(Math.random() * weights.length)] 
              G.setEdge(i, outgoingNeighbours[i][j], {ew:randWeight} );
              break;
            }
            
          }
        }
      }
    }
    let a = G._in
    let g = Object.keys(a[0])
    let m = a[0][g[0]].v
    return G;
  }

  this.nodesAndEdgeWeights = function (){
    let nodes = bitNodes["nodes"];
    let validNodes = new Array()
    
    for(let key in nodes){
      
      if(nodes[key][7] !=null ){
        validNodes.push(nodes[key][7].toLowerCase())        
      }
    }
    let validKeys = new Set()

    for(key in delayJson){
      let s = key.split("-")
      validKeys.add(s[0])
      validKeys.add(s[1])
      
    }
    // store the nodes that are present in DelayJson file
    // Proper nodes has the nodes that are present in DelayJson file
    let properNodes = new Array()
    for(let node of validNodes){
      if(validKeys.has(node)){
        properNodes.push(node)
      }
    }


    //get a unifom sample of 1000 nodes
    let sampledNodes = this.getRandomSample(properNodes ,1000)
    let nodesEdgeWeights = {}
    for(let node1 of sampledNodes){
      for(let node2 of sampledNodes){
        let key = `${node1}-${node2}`
        if(nodesEdgeWeights[key] == undefined){
          let edgeWeights = delayJson[key]
          if(edgeWeights==undefined){
            continue
          }
          let tempWeight = new Array()
          for(let wkey in edgeWeights){
            tempWeight.push(edgeWeights[wkey])
          }
          nodesEdgeWeights[key] = tempWeight.flat()
        } 
      }
    }
   
    return [nodesEdgeWeights , sampledNodes]
  }
  this.getRandomSample = function getRandomSubarray(arr, size) {
    var shuffled = arr.slice(0), i = arr.length, temp, index;
    while (i--) {
        index = Math.floor((i + 1) * Math.random());
        temp = shuffled[index];
        shuffled[index] = shuffled[i];
        shuffled[i] = temp;
    }
    return shuffled.slice(0, size);
  }

  this.WeigthedMatrix = function getWeightedMatrix(nodes , edgeWeights){
    let countries = ["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","CW","KM","CG","CD","CK","CR","CI","HR","CU","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MK","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","AN","NC","NZ","NI","NE","NG","NU","NF","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","SH","KN","LC","PM","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW"]
    
    let weightArray = new Array(nodes.length).fill(0);
    let i = 0;
    for(let n1 of nodes){
      weightArray[i] = new Array(nodes.length).fill(0);
      let j = 0;
      for(let n2 of nodes){
        let key = `${n1} - ${n2}`;
        try{
          let weights = edgeWeights[key]
          let randWeight = weights[Math.floor(Math.random() * weights.length)]
          weightArray[i][j] = randWeight;
        }
        catch{
          let countries1 = [...countries]
          while(true){
            
            let vnew = countries1[Math.floor(Math.random() * countries1.length)]
            const index = countries1.indexOf(vnew);
            if (index > -1) {
              countries1.splice(index, 1);
            }
            let key = `${n1}-${vnew.toLowerCase()}`
            let key1 = `${vnew.toLowerCase()}-${n1}`
            if(edgeWeights[key]){
              let weights = edgeWeights[key]
              let randWeight = weights[Math.floor(Math.random() * weights.length)] 
              weightArray[i][j] = randWeight;
              break;
            }
            if(edgeWeights[key1]){
              let weights = edgeWeights[key1]
              let randWeight = weights[Math.floor(Math.random() * weights.length)] 
              weightArray[i][j] = randWeight;
              break;
            }
            
          }
        }
        ++j;
      }
      ++i;
    }

    return weightArray
  }

  
}
//Test purpose
 obj = new Network(1,1,1000,20,8)
// //nodesAndEdgeWeights returns sample 1000 nodes and the country-country weights 
 let nodesInfo = obj.nodesAndEdgeWeights()
 let nodesEdges = nodesInfo[0] ;
 let nodes    = nodesInfo[1]
 G = obj.setNodesofGraph(nodes)
 const  [outgoingNeighbours,incommingNodeLimit] = obj.setRandomConnection()
 let delay = obj.setNodeDelay()
 let weightArray = obj.WeigthedMatrix(nodes,nodesEdges); 
 obj.setWeightedEdges(G,outgoingNeighbours,delay,nodesEdges)



function callNetwork(filedelay , networkType,numNodes,indegreeLimit,outDegree){
obj = new Network(filedelay , networkType,numNodes,indegreeLimit,outDegree)
//returns sampled 1000 node and the edges weight between nodes
let [nodesEdges , nodes] = obj.nodesAndEdgeWeights()
G = obj.setNodesofGraph(nodes)
//obj.setNodesofGraph("data1.json")
const  [outgoingNeighbours,incommingNodeLimit] = obj.setRandomConnection()
let delay = obj.setNodeDelay()
G = obj.setWeightedEdges(G,outgoingNeighbours,delay,nodesEdges)
return [G , delay] ;
}

exports.callNetwork = callNetwork;