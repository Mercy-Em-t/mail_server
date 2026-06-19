import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePct = ((usedMem / totalMem) * 100).toFixed(1);

    const serverUptimeHours = (process.uptime() / 3600).toFixed(2);

    return NextResponse.json({
        success: true,
        memory: `${memUsagePct}%`,
        uptime: `${serverUptimeHours} Hrs`,
        loadAverage: os.loadavg()[0].toFixed(2)
    });
}
