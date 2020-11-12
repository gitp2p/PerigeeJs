#!/usr/bin/env python
import networkx as nx
from math import radians, cos, sin, asin, sqrt
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
test_num=1000
#result 90 is written by this file
def plot50New(mean0,mean1,mean2,mean3,percent,title):
    x=range(number)
    fig = plt.figure()
    plt.plot(x,mean0,color='red',label="Random", linestyle='dashdot', )
    plt.plot(x,mean1,color='purple',label="round 4", linestyle='dashdot', )
    plt.plot(x,mean2,color='blue',label="round 64", linestyle='dashdot', )
    plt.plot(x,mean3,color='green',label="round 128", linestyle='dashdot', )

    plt.ylim((0,900))
    my_y_ticks=np.arange(0,900,100)
    plt.yticks(my_y_ticks)
    fig.suptitle(title, fontsize=12)
    plt.ylabel('Latency to '+ str(percent) +' hash')
    plt.xlabel("Sample nodes")
    plt.grid(True)
    plt.legend()
    plt.show()

number=1000
x=range(number)

for datacount in [1]:
    for method in ['subset','ucb']:
        mean = np.zeros([4,number])
        top1 = np.zeros([4,number])
        
        l = 0
        for r in [0,4,64,128]:
            filename="hash_"+str(method)+"V"+str(datacount)+"Round"+str(r)+".txt"
            #filename="old"+str(method)+"Round"+str(r)+".txt"
            file = open(filename,'r',errors='replace')
            top101=np.zeros(number)
            mean1=np.zeros(number)
            buff=np.zeros(number)
            line=file.readlines()
            for i in range(number):
                a=line[i].split("  ")
                for j in range(number):
                    buff[j]=int(float(a[j]))
                sortedBuff = sorted(buff)
                mean1[i]= sortedBuff[int(number*.5)]#delaytopercenthash(hash_buff,buff,50)
                top101[i] = sortedBuff[int(number*.9)]
            top101_0=sorted(top101)
            mean1_0=sorted(mean1)
            mean[l] = np.copy(mean1_0)
            top1[l] = np.copy(top101_0)
            l+=1  
        plot50New(mean[0],mean[1],mean[2],mean[3],"50%",method)
        plot50New(top1[0],top1[1],top1[2],top1[3], "90%",method)
