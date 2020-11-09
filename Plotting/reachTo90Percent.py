#!/usr/bin/env python
import networkx as nx
from math import radians, cos, sin, asin, sqrt
import numpy as np
import os
test_num=1000
#result 90 is written by this file
def delaytopercenthash(hash_table,length_buff,DelayPercantage):
    LengthDict={}
    for i in range(len(length_buff)):
        length_buff[i]=length_buff[i]*1000+i
        LengthDict[str(length_buff[i])]=hash_table[i]
    sorted_length_buff=sorted(length_buff,reverse=True)
    hashcounter=0
    for i in range(len(length_buff)):
        hashcounter=hashcounter+LengthDict[str(sorted_length_buff[i])]
        # print(hashcounter,LengthDict[str(sorted_length_buff[i])],sorted_length_buff[i])
        if hashcounter>test_num*(1-DelayPercantage/100):
            return(int(sorted_length_buff[i]/1000))
        



number=1000
x=range(number)
'''
    hash=np.zeros(number)
    #address="/Users/maoyifan/Desktop/redoband430/"

    hash1=np.zeros(number)
    #file = open(address+"hash1.txt",'r',errors='replace')
    file = open("hash1.txt",'r',errors='replace')
    line=file.readlines()
    a=line[0].split("  ")
    for j in range(number):
        hash1[j]=float(a[j])
    file.close()

    hash2=np.zeros(number)
    #file = open(address+"hash2.txt",'r',errors='replace')
    file = open("hash2.txt",'r',errors='replace')
    line=file.readlines()
    a=line[0].split("  ")
    for j in range(number):
        hash2[j]=float(a[j])
    file.close()

    hash3=np.zeros(number)
    #file = open(address+"hash3.txt",'r',errors='replace')
    file = open("hash2.txt",'r',errors='replace')
    line=file.readlines()
    a=line[0].split("  ")
    for j in range(number):
        hash3[j]=float(a[j])
    file.close()
'''
fn1 = "../PlotData/hash_ucbV1Round0.txt"
fn2 = "../PlotData/hash_ucbV1Round4.txt"
fn3 = "../PlotData/hash_ucbV1Round16.txt"
fn4 = "../PlotData/hash_ucbV1Round128.txt"
for datacount in [1]:
    for method in ['localucp']:#['subset','ucb']
        cwd = os.getcwd()
        os.chdir("D:\\My work\\Mtp\\PerigeeJs\\Plotting\\PlotData")
        for r in [0,4,8,16,32,64,128]:
            '''
            filename= "hash_"+str(method)+"V"+str(datacount)+"Round"+str(r)+".txt"
            file = open(filename,'r',errors='replace')
            top101=np.zeros(number)
            mean1=np.zeros(number)
            buff=np.zeros(number)
            line=file.readlines()
            for i in range(number):
                a=line[i].split("  ")
                for j in range(number):
                    buff[j]=int(float(a[j]))
                buff=sorted(buff)
                #take 90% values
                top101[i]= buff[int(test_num*0.9)]
                mean1[i]= buff[int(test_num*0.5)]
            top101_0=sorted(top101)
            mean1_0=sorted(mean1)
            file.close()
            try:
                os.mkdir("result50")
                os.mkdir("result90")
            except:
                print()
            cwd = os.getcwd()
            os.chdir("result90")
            outputfilename="result90"+filename
            
            fwl=open(outputfilename,'a')
            for i in range(test_num):
                fwl.write(str(top101_0[i])+'  ')
            fwl.close()
            os.chdir(cwd)
            os.chdir("result50")
            outputfilename="result50"+filename
            fwl=open(outputfilename,'a')
            for i in range(test_num):
                fwl.write(str(mean1_0[i])+'  ')
            fwl.close()
            os.chdir(cwd)
            '''
            filename="hash_"+str(method)+"V"+str(datacount)+"Round"+str(r)+".txt"
            file = open(filename,'r',errors='replace')
            top101=np.zeros(number)
            mean1=np.zeros(number)
            buff=np.zeros(number)
            line=file.readlines()
            for i in range(number):
                a=line[i].split("  ")
                for j in range(number):
                    buff[j]=int(float(a[j]))
                hash_buff=locals()['hash'+str(datacount)]
                sortedBuff = sorted(buff)[500]
                mean1[i]= delaytopercenthash(hash_buff,buff,50)
            buff=np.zeros(number)
            for i in range(number):
                a=line[i].split("  ")
                for j in range(number):
                    buff[j]=int(float(a[j]))
                hash_buff=locals()['hash'+str(datacount)]
                top101[i]= delaytopercenthash(hash_buff,buff,90)
            top101_0=sorted(top101)
            mean1_0=sorted(mean1)
            file.close()
            try:
                os.mkdir("result50")
                os.mkdir("result90")
            except:
                print()
            outputfilename="result90"+filename
            fwl=open(outputfilename,'a')
            for i in range(test_num):
                fwl.write(str(top101_0[i])+'  ')
            fwl.close()
            outputfilename="result50"+filename
            fwl=open(outputfilename,'a')
            for i in range(test_num):
                fwl.write(str(mean1_0[i])+'  ')
            fwl.close()
            os.chdir(cwd)
        '''
            filename="treehash_"+str(method)+"V"+str(datacount)+"Round"+str(r)+".txt"
            file = open(filename,'r',errors='replace')
            top101=np.zeros(number)
            mean1=np.zeros(number)
            buff=np.zeros(number)
            line=file.readlines()
            for i in range(number):
                a=line[i].split("  ")
                for j in range(number):
                    buff[j]=int(float(a[j]))
                hash_buff=locals()['hash'+str(datacount)]
                mean1[i]= delaytopercenthash(hash_buff,buff,50)
            buff=np.zeros(number)
            for i in range(number):
                a=line[i].split("  ")
                for j in range(number):
                    buff[j]=int(float(a[j]))
                hash_buff=locals()['hash'+str(datacount)]
                top101[i]= delaytopercenthash(hash_buff,buff,90)
            top101_0=sorted(top101)
            mean1_0=sorted(mean1)
            file.close()
            outputfilename="result90"+filename
            fwl=open(outputfilename,'a')
            for i in range(test_num):
                fwl.write(str(top101_0[i])+'  ')
            fwl.close()
            outputfilename="result50"+filename
            fwl=open(outputfilename,'a')
            for i in range(test_num):
                fwl.write(str(mean1_0[i])+'  ')
            fwl.close()
            filename="lowlatencyhash_"+str(method)+"V"+str(datacount)+"Round"+str(r)+".txt"
            file = open(filename,'r',errors='replace')
            top101=np.zeros(number)
            mean1=np.zeros(number)
            buff=np.zeros(number)
            line=file.readlines()
            for i in range(number):
                a=line[i].split("  ")
                for j in range(number):
                    buff[j]=int(float(a[j]))
                hash_buff=locals()['low'+str(datacount)]
                mean1[i]= delaytopercenthash(hash_buff,buff,50)
            buff=np.zeros(number)
            for i in range(number):
                a=line[i].split("  ")
                for j in range(number):
                    buff[j]=int(float(a[j]))
                hash_buff=locals()['low'+str(datacount)]
                top101[i]= delaytopercenthash(hash_buff,buff,90)
            top101_0=sorted(top101)
            mean1_0=sorted(mean1)
            file.close()
            outputfilename="result90"+filename
            fwl=open(outputfilename,'a')
            for i in range(test_num):
                fwl.write(str(top101_0[i])+'  ')
            fwl.close()
            outputfilename="result50"+filename
            fwl=open(outputfilename,'a')
            for i in range(test_num):
                fwl.write(str(mean1_0[i])+'  ')
            fwl.close()
        '''