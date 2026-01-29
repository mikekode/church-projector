const http = require('http');

const check = () => {
    const req = http.get('http://localhost:3030/dashboard', (res) => {
        console.log('STATUS:', res.statusCode);
        process.exit(res.statusCode === 200 ? 0 : 1);
    });

    req.on('error', (e) => {
        console.error('ERROR:', e.message);
        process.exit(1);
    });
};

setTimeout(check, 5000);
