'use client';

import React from 'react';
import { StatData } from '../types';

interface StatsProps {
    stats: StatData[];
}

export default function Stats({ stats }: StatsProps) {
    if (!stats || stats.length === 0) return null;

    return (
        <div className="container stats-wrapper">
            <div className="stats-bar" id="stats-container">
                {stats.map((stat, idx) => (
                    <div className="stat-item" key={idx}>
                        <i className={`${stat.icon} stat-icon`}></i>
                        <div className="stat-text">
                            <h3>{stat.value}</h3>
                            <p>{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
