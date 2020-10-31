const { readFile } = require("fs");
const fetch = require("node-fetch");
fs = require('fs');

let country_country = {}
function fetchLoc(ip1 , ip2,delay){
    console.log(`http://ip-api.com/json/${ip1}`)
    let fetchIp1 = fetch(`http://ip-api.com/json/${ip1}`)
    let fetchIp2 = fetch(`http://ip-api.com/json/${ip2}`)
    let data = new Array(2)
    let i = 0;
    
        // conkey = `${data[0]["countryCode"].toLowerCase()}-${data[1]["countryCode"].toLowerCase()}`
        // citykey = `${data[0]["city"].toLowerCase()}-${data[1]["city"].toLowerCase()}`
        // country_country[conkey] = {citykey:delay}
        // console.log(country_country)
    Promise.all([
        fetchIp1,fetchIp2
    ]).then(function (responses) {
            // Get a JSON object from each of the responses
        return Promise.all(responses.map(function (response) {
            return response.json();
        }));
    }).then(function (data) {
        // Log the data to the console
        // You would do something with both sets of data here
        console.log(data);
    }).catch(function (error) {
        // if there's an error, log it
        console.log(error);
    });
}

//original========> linkipsdelays
fs.readFile('linkipsdelays','utf8', (err,data)=>{
    if(err){
        return console.log(err)
    }

    async function callfetch(data){
        dataList = data.split('\n')
        dataNew = new Array(dataList.length)
        for(let i =0 ; i<dataList.length;i++){
            dataNew[i] = dataList[i].trim()
        }
        for(let i = 0 ; i<dataNew.length;++i){
        
        let ips = dataNew[i].split(' ');
        
        await fetchLocation(ips[0],ips[1],ips[2])
        await new Promise(r => setTimeout(r, 2700));    
    }
    }
    async function fetchLocation(ip1,ip2,delay) { 
        let fetchIp1 = `http://ip-api.com/json/${ip1}`
        let fetchIp2 = `http://ip-api.com/json/${ip2}`
        // Storing response 
        const response1 = await fetch(fetchIp1); 
        const response2 = await fetch(fetchIp2)

        // Storing data in form of JSON 
        let data = new Array(2);
        data[0] = await response1.json(); 
        data[1] = await response2.json(); 
        let conkey = `${data[0]["countryCode"].toLowerCase()}-${data[1]["countryCode"].toLowerCase()}`
        let citykey = `${data[0]["city"].toLowerCase()}-${data[1]["city"].toLowerCase()}`
        if(country_country[conkey] ==undefined){
            country_country[conkey] = {}
        }
        if(country_country[conkey][citykey] == undefined){
            country_country[conkey][citykey] = [delay]
        }
        else{
            country_country[conkey][citykey].push(delay)
        }
        
        
        
    } 
    
    (async function () {
        // wait to http request to finish
        await callfetch(data);
        fs.writeFileSync('newDelays.json', JSON.stringify(country_country));
        // below code will be executed after http request is finished
        // some code
    })();
    
})
console.log('hi')
