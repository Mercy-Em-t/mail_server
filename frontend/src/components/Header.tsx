'use client';

import React from 'react';
import Link from 'next/link';
import { BrandData, NavLink } from '../types';

interface HeaderProps {
    brand: BrandData;
    nav: NavLink[];
    headerAction: string;
    userId?: string;
    lang?: string;
}

export default function Header({ brand, nav, headerAction, userId, lang = 'en' }: HeaderProps) {
    return (
        <header>
            <div className="logo logo-container">
                <span className="logo-icon">{brand?.icon}</span>
                <div>
                    <span className="logo-text">{brand?.name}</span>
                    <span className="logo-sub">{brand?.sub}</span>
                </div>
            </div>
            
            <nav>
                <ul id="nav-links">
                    {nav?.map((link, idx) => (
                        <li key={idx}>
                            <Link 
                                href="#" 
                                className={link.active ? 'active' : ''}
                                style={link.active ? { color: 'var(--accent)', borderBottom: '1px solid var(--accent)', paddingBottom: '5px' } : {}}
                            >
                                {link.text}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
            
            <div className="header-actions">
                <Link href={`?lang=en${userId ? '&user_id='+userId : ''}`} style={{ color: 'white', fontSize: '0.8rem', fontWeight: 'bold' }}>EN</Link>
                <span style={{ color: '#555' }}>|</span>
                <Link href={`?lang=es${userId ? '&user_id='+userId : ''}`} style={{ color: 'white', fontSize: '0.8rem', fontWeight: 'bold' }}>ES</Link>
                
                <Link href="#" className="btn btn-outline" id="header-action-btn" style={{ marginLeft: '15px' }}>
                    {headerAction}
                </Link>
                <div className="menu-btn"><i className="fa-solid fa-ellipsis"></i></div>
            </div>
        </header>
    );
}
