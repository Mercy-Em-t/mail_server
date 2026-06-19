'use client';

import React from 'react';
import { ProjectsSection } from '../types';

interface ProjectsProps {
    projects: ProjectsSection;
}

export default function Projects({ projects }: ProjectsProps) {
    if (!projects) return null;

    return (
        <section className="container split-section">
            <div className="split-left" id="projects-left">
                <span className="section-tag">{projects.tag}</span>
                <h2 dangerouslySetInnerHTML={{ __html: projects.title }}></h2>
                <a href="#" className="btn btn-light" dangerouslySetInnerHTML={{ __html: projects.buttonText }}></a>
            </div>
            
            <div className="split-right">
                <div className="projects-grid" id="projects-grid">
                    {projects.items?.map((item, idx) => (
                        <div className={`project-card ${item.class}`} key={idx}>
                            <img src={item.image} alt={item.title} />
                            <div className="project-info">
                                <div>
                                    <h4>{item.title}</h4>
                                    <p>{item.location}</p>
                                </div>
                                <div className="project-arrow"><i className="fa-solid fa-arrow-right"></i></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
