const { spawn } = require('child_process');
const path = require('path');

const server = spawn('node', ['src/index.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';

server.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    
    for (const line of lines) {
        if (line.trim()) {
            try {
                const msg = JSON.parse(line);
                console.log('\n📨 MCP RESPONSE:');
                console.log(JSON.stringify(msg, null, 2));
            } catch (e) {
                console.log('📝 Raw output:', line);
            }
        }
    }
});

server.stderr.on('data', (data) => {
    console.log('🔵', data.toString().trim());
});

// Wait for server to start
setTimeout(() => {
    console.log('\n🔍 Requesting tool list...\n');
    
    const listRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
    };
    server.stdin.write(JSON.stringify(listRequest) + '\n');
    
}, 2000);

// Request a tool call
setTimeout(() => {
    console.log('\n Estimating sales for ASIN: 059035342X...\n');
    
    const callRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
            name: 'estimate_amazon_sales',
            arguments: {
                asin: '059035342X'
            }
        }
    };
    server.stdin.write(JSON.stringify(callRequest) + '\n');
    
}, 5000);

// Exit after 15 seconds
setTimeout(() => {
    console.log('\n Test complete. Shutting down...');
    server.kill();
    process.exit();
}, 15000);