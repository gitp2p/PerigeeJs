import numpy as np
import json
import os;
import random
class GenerateData:
  def __init__(self ,num_nodes):
    self.nodes = num_nodes
  #it Generates Hash Power of the nodes
  def GenHash(self,filename ):
    hash = [np.random.exponential(1) for i in range(0,self.nodes) ]
    nor_val = self.nodes / sum(hash)
    with open(filename, "w+") as fp:
      for x in hash:
        fp.write(str(x*nor_val) + '  ' )  
  #Randomly generate ToP 10 % nodes 
  def TopNodes(self,filename):
    topNodes = random.sample(range(0,self.nodes) ,self.nodes/10 )
    nor_val = self.nodes / sum(hash)
    with open(filename, "w+") as fp:
      for x in topNodes:
        fp.write(str(x*nor_val) + '  ' )  
  
  def GenLinkDelay(self,filename,writeFile):
    '''
    Later once data is avilable change this 
    os.chdir("Data")
    print(os.getcwd())
    fp = open(filename,encoding="utf8")
    os.chdir("../src")
    Jobj = json.load(fp)
    
    for i in Jobj["nodes"]:
      node = Jobj["nodes"][i]
    '''
    os.chdir("../Data")
    linkDelays = np.random.normal(200,50,self.nodes)
    with open(writeFile, "w") as fp:
      for i in linkDelays:
        i = round(i)
        fp.write( str(i) + ' ' )
      
gendata = GenerateData(1000) 

gendata.GenLinkDelay("bitnodes.json","linkDelays.text")