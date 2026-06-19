'use client';

import React from 'react';
import Link from 'next/link';
import { FooterData } from '../types';

interface FooterProps {
    footer: FooterData;
    brandText: string;
}

export default function Footer({ footer, brandText }: FooterProps) {
    if (!footer) return null;

    return (
        <footer>
            <div className="container">
                <div className="footer-top">
                    <div className="footer-cta" id="footer-cta">
                        <h2 dangerouslySetInnerHTML={{ __html: footer.ctaTitle }}></h2>
                        <button className="btn btn-solid" dangerouslySetInnerHTML={{ __html: footer.ctaButton }}></button>
                    </div>
                    
                    <div className="footer-contact" id="footer-contact">
                        <ul>
                            {footer.contact?.map((item, idx) => (
                                <li key={idx}>
                                    <i className={item.icon}></i>
                                    <span dangerouslySetInnerHTML={{ __html: item.text }}></span>
                                </li>
                            ))}
                        </ul>
                        <div className="social-links">
                            {footer.social?.map((social, idx) => (
                                <Link key={idx} href={social.link}>
                                    <i className={social.icon}></i>
                                </Link>
                            ))}
                        </div>
                    </div>
                    
                    <div className="footer-brand" id="footer-brand">
                        <div className="logo logo-container">
                            <span className="logo-icon">N</span>
                            <div>
                                <span className="logo-text">NEXUS</span>
                                <span className="logo-sub">TECH & OPERATIONS</span>
                            </div>
                        </div>
                        <p>{footer.brandText || brandText}</p>
                    </div>
                </div>
                
                <div className="footer-bottom">
                    <p id="footer-copyright" dangerouslySetInnerHTML={{ __html: footer.copyright }}></p>
                    <div className="footer-links" id="footer-links">
                        {footer.links?.map((link, idx) => (
                            <Link key={idx} href="#">{link}</Link>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
