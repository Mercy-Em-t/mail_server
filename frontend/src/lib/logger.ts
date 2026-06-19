import fs from 'fs';
import path from 'path';

export function logActivity(username: string, action: string, status: string = 'SUCCESS') {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logLine = `[${timestamp}] User: '${username}' | Action: ${action} | Status: ${status}\n`;
    
    // We log to the legacy node version directory as per the plan
    const logPath = path.join(process.cwd(), '../legacy_node_version/logs.txt');
    
    fs.appendFile(logPath, logLine, 'utf8', (err) => {
        if (err) console.error('⚠️ Critical: Failed to write to system audit log:', err);
    });
}
