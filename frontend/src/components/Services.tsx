'use client';

import React from 'react';
import { ServicesSection } from '../types';

interface ServicesProps {
    services: ServicesSection;
}

export default function Services({ services }: ServicesProps) {
    if (!services) return null;

    return (
        <section className="services-section">
            <div className="container split-section">
                <div className="split-left" id="services-left">
                    <span className="section-tag">{services.tag}</span>
                    <h2 dangerouslySetInnerHTML={{ __html: services.title }}></h2>
                    <p>{services.text}</p>
                    <a href="#" className="btn btn-solid" style={{ marginTop: '30px' }} dangerouslySetInnerHTML={{ __html: services.buttonText }}></a>
                </div>
                
                <div className="split-right">
                    <div className="services-grid" id="services-grid">
                        {services.items?.map((item, idx) => (
                            <div className="service-card" key={idx}>
                                <i className={item.icon}></i>
                                <h4>{item.title}</h4>
                                <p>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
