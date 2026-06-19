'use client';

import React from 'react';
import { InsightsSection } from '../types';

interface InsightsProps {
    insights: InsightsSection;
}

export default function Insights({ insights }: InsightsProps) {
    if (!insights) return null;

    return (
        <section className="insights-section">
            <div className="container split-section">
                <div className="split-left" id="insights-left">
                    <span className="section-tag">{insights.tag}</span>
                    <h2 dangerouslySetInnerHTML={{ __html: insights.title }}></h2>
                    <a href="#" className="btn btn-solid" dangerouslySetInnerHTML={{ __html: insights.buttonText }}></a>
                </div>
                
                <div className="split-right">
                    <div className="insights-grid" id="insights-grid">
                        {insights.items?.map((item, idx) => (
                            <div className="insight-card" key={idx}>
                                <img src={item.image} alt={item.title} />
                                <div className="insight-content">
                                    <span className="insight-date">{item.date}</span>
                                    <h4>{item.title}</h4>
                                    <a href="#" className="read-more">Read Article <i className="fa-solid fa-arrow-right"></i></a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
