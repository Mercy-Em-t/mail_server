'use client';

import React from 'react';
import { ProcessSection } from '../types';

interface ProcessProps {
    process: ProcessSection;
}

export default function Process({ process }: ProcessProps) {
    if (!process) return null;

    return (
        <section className="container split-section">
            <div className="split-left" id="process-left">
                <span className="section-tag">{process.tag}</span>
                <h2 dangerouslySetInnerHTML={{ __html: process.title }}></h2>
                <a href="#" className="btn btn-outline" style={{ marginTop: '30px' }}>{process.buttonText}</a>
            </div>
            
            <div className="split-right">
                <div className="process-row" id="process-row">
                    {process.items?.map((item, idx) => (
                        <div className="process-step" key={idx}>
                            <div className="step-number" style={item.highlight ? { backgroundColor: 'var(--text-light)', color: 'var(--bg-dark)' } : {}}>
                                {item.number}
                            </div>
                            <h4>{item.title}</h4>
                            <p>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
