'use client';

import React from 'react';
import { HeroData } from '../types';

interface HeroProps {
    hero: HeroData;
}

export default function Hero({ hero }: HeroProps) {
    if (!hero) return null;

    return (
        <section 
            className="hero" 
            id="hero-section"
            style={{
                backgroundImage: `linear-gradient(rgba(18, 19, 21, 0.8), rgba(18, 19, 21, 0.6)), url('${hero.bgImage}')`
            }}
        >
            <div className="container hero-content">
                <span className="section-tag" id="hero-tag">{hero.tagline}</span>
                <h1 id="hero-head" dangerouslySetInnerHTML={{ __html: hero.headline }}></h1>
                <p id="hero-sub" dangerouslySetInnerHTML={{ __html: hero.subtext }}></p>
                <a href="#" className="btn btn-solid" id="hero-btn">
                    {hero.buttonText} <i className="fa-solid fa-arrow-right"></i>
                </a>
            </div>
        </section>
    );
}
