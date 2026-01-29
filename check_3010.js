const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3010,
    path: '/dashboard',
    method: 'GET',
    timeout: 3000
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', () => { }); // Consume
    res.on('end', () => console.log('Response ended'));
});

req.on('error', (e) => {
    console.error(`PROBLEM: ${e.message}`);
});

req.end();
