const http = require('http');

const req = http.get('http://localhost:3002/dashboard', (res) => {
    console.log('STATUS:', res.statusCode);
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('BODY LENGTH:', data.length);
        if (res.statusCode === 200) {
            if (data.includes('SMART PROJECTOR')) {
                console.log('SUCCESS: Dashboard loaded');
            } else {
                console.log('WARNING: Dashboard content missing');
            }
        }
    });
});

req.on('error', (e) => {
    console.error('ERROR:', e.message);
});
