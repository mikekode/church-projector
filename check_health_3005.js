const http = require('http');

setTimeout(() => {
    const req = http.get('http://localhost:3005/dashboard', (res) => {
        console.log('STATUS:', res.statusCode);
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log('BODY LENGTH:', data.length);
            if (res.statusCode === 200) {
                console.log('SUCCESS: Dashboard loaded');
            }
        });
    });

    req.on('error', (e) => {
        console.error('ERROR:', e.message);
    });
}, 5000);
