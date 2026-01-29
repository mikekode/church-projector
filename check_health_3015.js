const http = require('http');

setTimeout(() => {
    const req = http.get('http://localhost:3015/dashboard', (res) => {
        console.log('STATUS:', res.statusCode);
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log('SUCCESS: Dashboard loaded');
            } else {
                console.log('FAIL: ' + res.statusCode);
            }
        });
    });

    req.on('error', (e) => {
        console.error('ERROR:', e.message);
    });
}, 5000);
